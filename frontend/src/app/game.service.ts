import { inject, Injectable, signal } from '@angular/core';
import { SoundService } from './sound.service';
import { Apollo, TypedDocumentNode } from 'apollo-angular';
import { firstValueFrom } from 'rxjs';
import {
  AcheterAngelUpgradeDocument,
  AcheterCashUpgradeDocument,
  AcheterQtProduitDocument,
  EngagerManagerDocument,
  GetWorldDocument,
  LancerProductionProduitDocument,
  ResetWorldDocument,
} from './graphql/operations';
import { Palier, Product, World } from './graphql/schema-types';
import {
  normalizeServerUrl,
  saveServerUrl,
  saveWorldList,
  serverUrl,
  worldList,
} from './world-servers';

type PalierSource =
  | { kind: 'productPalier'; productId: number }
  | { kind: 'allunlock' }
  | { kind: 'upgrade' }
  | { kind: 'angelupgrade' };

// Le sujet decrit une API "apollo.signal.query/mutation" qui n'existe pas
// dans le package apollo-angular reellement publie (verifie dans ses
// types : seules watchQuery/query/mutate existent, pas de namespace
// "signal"). On obtient le meme resultat - un signal `world` qui pilote le
// gabarit, un refreshWorld() qui recharge depuis le serveur, des mutations
// qui remontent une erreur exploitable - avec les briques Angular/Apollo
// reelles : un signal ecrit a la main + Apollo.query/mutate en promesses.
@Injectable({ providedIn: 'root' })
export class GameService {
  // Adresse du serveur de monde courant (partagée avec le lien Apollo).
  readonly server = serverUrl.asReadonly();

  // Mondes enregistrés (liste modifiable par le joueur).
  readonly worlds = worldList.asReadonly();

  readonly user = signal(this.initUsername());

  readonly world = signal<World | undefined>(undefined);

  // Message éphémère à afficher. Le compteur garantit qu'un même texte
  // (deux achats identiques de suite) déclenche quand même un nouvel affichage.
  readonly snackmessage = signal<{ texte: string; n: number }>({ texte: '', n: 0 });

  notify(texte: string) {
    this.snackmessage.update((m) => ({ texte, n: m.n + 1 }));
  }

  // x1 -> x10 -> x100 -> Max -> x1 ...
  readonly qtmulti = signal<'x1' | 'x10' | 'x100' | 'Max'>('x1');

  readonly acheterProduitsError = signal(false);

  // Incrémenté à chaque rechargement du monde depuis le serveur : les
  // produits s'en servent pour abandonner leurs productions en cours, qui
  // ne correspondent plus à l'état serveur (reset, changement de joueur).
  readonly worldVersion = signal(0);

  private sons = inject(SoundService);

  constructor(private apollo: Apollo) {
    this.refreshWorld();
  }

  private initUsername(): string {
    let username = localStorage.getItem('username');
    if (!username) {
      username = 'Captain' + Math.floor(Math.random() * 10000);
      // mémorisé tout de suite : sinon chaque rechargement tirerait un
      // nouveau pseudo et le joueur perdrait son monde
      localStorage.setItem('username', username);
    }
    return username;
  }

  commitName(name: string) {
    localStorage.setItem('username', name);
    this.user.set(name);
    this.refreshWorld();
  }

  // URL complète d'une image du monde. Les serveurs ne s'accordent pas sur
  // la forme des chemins ("icones/a.png" ou "/icones/a.png") : on garantit
  // un seul "/" entre l'adresse du serveur et le chemin.
  img(chemin: string | null | undefined): string {
    if (!chemin) return '';
    if (/^(https?:)?\/\//.test(chemin) || chemin.startsWith('data:')) return chemin;
    return this.server() + '/' + chemin.replace(/^\/+/, '');
  }

  // Bascule sur un autre serveur de monde (interopérabilité) : le monde et
  // les animations en cours sont abandonnés au profit de ceux du serveur.
  // Renvoie false si le serveur n'a pas fourni de monde.
  async setServer(url: string): Promise<boolean> {
    const cible = normalizeServerUrl(url);
    if (!cible) return false;
    if (cible === this.server() && this.world()) return true;
    saveServerUrl(cible);
    this.world.set(undefined);
    return this.refreshWorld();
  }

  // Ajoute un monde : il n'est gardé dans la liste que si son serveur répond
  // avec un monde ; sinon on revient au monde précédent.
  async addWorld(url: string): Promise<boolean> {
    const cible = normalizeServerUrl(url);
    if (!cible) return false;
    const precedent = this.server();
    if (await this.setServer(cible)) {
      if (!this.worlds().some((w) => w.url === cible)) {
        saveWorldList([...this.worlds(), { name: this.world()!.name, url: cible }]);
      }
      this.notify(`World "${this.world()!.name}" added`);
      return true;
    }
    this.notify(`No world found at ${cible}`);
    await this.setServer(precedent);
    return false;
  }

  // Retire un monde de la liste ; si c'était le monde affiché, on passe au
  // premier monde restant.
  async removeWorld(url: string) {
    const restants = this.worlds().filter((w) => w.url !== url);
    if (restants.length === 0) {
      this.notify('At least one world must remain');
      return;
    }
    const nom = this.worlds().find((w) => w.url === url)?.name ?? url;
    saveWorldList(restants);
    this.notify(`World "${nom}" removed`);
    if (url === this.server()) await this.setServer(restants[0].url);
  }

  private refreshEnCours = false;

  // Recharge le monde depuis le serveur. Par défaut les productions en cours
  // sont interrompues (reset, changement de joueur, bouton Refresh) ; avec
  // `douce`, seules les données sont remplacées et les barres de production
  // continuent de tourner, ce qui évite de les faire clignoter à chaque
  // petite dérive corrigée par le serveur.
  async refreshWorld(douce = false): Promise<boolean> {
    if (douce && this.refreshEnCours) return true;
    this.refreshEnCours = true;
    try {
      const { data } = await firstValueFrom(
        this.apollo.query({
          query: GetWorldDocument,
          variables: { user: this.user() },
          // pas de cache : deux serveurs peuvent avoir des produits de même
          // id, qu'un cache normalisé mélangerait
          fetchPolicy: 'no-cache',
        }),
      );
      if (!data?.getWorld) throw new Error('Empty response from the server');
      this.world.set(data.getWorld as World);
      if (!douce) this.worldVersion.update((v) => v + 1);
      return true;
    } catch {
      this.notify('Could not load the world from the server');
      return false;
    } finally {
      this.refreshEnCours = false;
    }
  }

  cycleQtMulti() {
    const suivant = { x1: 'x10', x10: 'x100', x100: 'Max', Max: 'x1' } as const;
    this.qtmulti.update((q) => suivant[q]);
  }

  // Quantité supplémentaire achetable d'un produit selon la position du
  // commutateur général (qtmulti) et l'argent actuellement disponible.
  // coût de n unités = cout * (1 + c + c^2 + ... + c^(n-1))
  numberToBuy(product: Product): number {
    const mode = this.qtmulti();
    if (mode === 'x1') return 1;
    if (mode === 'x10') return 10;
    if (mode === 'x100') return 100;

    // Max : on cherche le plus grand n tel que le cout cumule <= argent
    const money = this.world()?.money ?? 0;
    const c = product.croissance;
    let n = 0;
    let coutUnitaire = product.cout;
    let coutTotal = 0;
    while (coutTotal + coutUnitaire <= money) {
      coutTotal += coutUnitaire;
      coutUnitaire *= c;
      n++;
    }
    return n;
  }

  // Coût cumulé de l'achat de n exemplaires : le prix de chaque exemplaire
  // est celui du précédent multiplié par la croissance du produit.
  coutTotal(product: Product, n: number): number {
    let coutUnitaire = product.cout;
    let total = 0;
    for (let i = 0; i < n; i++) {
      total += coutUnitaire;
      coutUnitaire *= product.croissance;
    }
    return total;
  }

  canBuy(product: Product): boolean {
    const n = this.numberToBuy(product);
    return n > 0 && (this.world()?.money ?? 0) >= this.coutTotal(product, n);
  }

  productionDone(product: Product, qt: number) {
    const world = this.world();
    if (!world) return;
    const gain =
      product.revenu *
      product.quantite *
      qt *
      (1 + (world.activeangels * world.angelbonus) / 100);

    this.world.update((w) => {
      if (!w) return w;
      return { ...w, money: w.money + gain, score: w.score + gain };
    });
  }

  async startProduction(product: Product) {
    await this.mutate(LancerProductionProduitDocument, {
      user: this.user(),
      id: product.id,
    });
  }

  async buyProduct(qt: number, product: Product) {
    const world = this.world();
    if (!world) return;

    const cost = this.coutTotal(product, qt);
    if (qt <= 0 || world.money < cost) return;
    const coutUnitaire = product.cout * Math.pow(product.croissance, qt);

    const newproductlist = world.products.map((p) => {
      if (p.id !== product.id) return p;
      return { ...p, quantite: p.quantite + qt, cout: coutUnitaire };
    });
    this.world.set({ ...world, products: newproductlist, money: world.money - cost });
    this.notify(`Bought ${qt} ${product.name}`);
    this.checkUnlocks(product.id);

    await this.mutate(AcheterQtProduitDocument, {
      user: this.user(),
      id: product.id,
      quantite: qt,
    });
  }

  async hireManager(manager: Palier) {
    const world = this.world();
    if (!world || world.money < manager.seuil) return;

    const newproductlist = world.products.map((p) =>
      p.id === manager.idcible ? { ...p, managerUnlocked: true } : p,
    );
    const newmanagers = world.managers.map((m) =>
      m.name === manager.name ? { ...m, unlocked: true } : m,
    );
    this.world.set({
      ...world,
      products: newproductlist,
      managers: newmanagers,
      money: world.money - manager.seuil,
    });
    this.notify(`${manager.name} joined your team!`);

    await this.mutate(EngagerManagerDocument, {
      user: this.user(),
      name: manager.name,
    });
  }

  async buyCashUpgrade(upgrade: Palier) {
    const world = this.world();
    if (!world || world.money < upgrade.seuil || upgrade.unlocked) return;

    this.applyUpgrade(upgrade, { kind: 'upgrade' }, 'money');
    await this.mutate(AcheterCashUpgradeDocument, {
      user: this.user(),
      name: upgrade.name,
    });
  }

  async buyAngelUpgrade(upgrade: Palier) {
    const world = this.world();
    if (!world || world.activeangels < upgrade.seuil || upgrade.unlocked) return;

    this.applyUpgrade(upgrade, { kind: 'angelupgrade' }, 'activeangels');
    await this.mutate(AcheterAngelUpgradeDocument, {
      user: this.user(),
      name: upgrade.name,
    });
  }

  async resetWorld() {
    const avant = this.world()?.activeangels ?? 0;
    await this.mutate(ResetWorldDocument, { user: this.user() });
    if (await this.refreshWorld()) {
      const gagnes = (this.world()?.activeangels ?? 0) - avant;
      this.notify(`World reset: ${gagnes} new angel${gagnes > 1 ? 's' : ''} active`);
    }
  }

  // ---- unlocks / upgrades : logique de bonus partagée ----

  private checkUnlocks(productId: number) {
    const world = this.world();
    if (!world) return;
    const product = world.products.find((p) => p.id === productId);
    if (!product) return;

    for (const palier of product.paliers) {
      if (!palier.unlocked && product.quantite >= palier.seuil) {
        this.applyUpgrade(palier, { kind: 'productPalier', productId });
      }
    }

    const quantiteMin = Math.min(...this.world()!.products.map((p) => p.quantite));
    for (const palier of this.world()!.allunlocks) {
      if (!palier.unlocked && quantiteMin >= palier.seuil) {
        this.applyUpgrade(palier, { kind: 'allunlock' });
      }
    }
  }

  private applyUpgrade(
    palier: Palier,
    source: PalierSource,
    monnaie?: 'money' | 'activeangels',
  ) {
    const world = this.world();
    if (!world) return;

    const produits = world.products.map((p) => {
      let mis_a_jour = p;
      if (
        palier.typeratio === 'vitesse' &&
        (palier.idcible === 0 || p.id === palier.idcible)
      ) {
        mis_a_jour = { ...mis_a_jour, vitesse: mis_a_jour.vitesse / palier.ratio };
      }
      if (
        palier.typeratio === 'gain' &&
        (palier.idcible === 0 || p.id === palier.idcible)
      ) {
        mis_a_jour = { ...mis_a_jour, revenu: mis_a_jour.revenu * palier.ratio };
      }
      if (source.kind === 'productPalier' && p.id === source.productId) {
        mis_a_jour = {
          ...mis_a_jour,
          paliers: mis_a_jour.paliers.map((pal) =>
            pal.name === palier.name ? { ...pal, unlocked: true } : pal,
          ),
        };
      }
      return mis_a_jour;
    });

    // Pour un bonus de type "ange", le sujet demande d'AJOUTER ratio au
    // bonus actuel des anges (ex. ratio 2 : 2 % -> 4 %), pas de le multiplier.
    const angelbonus =
      palier.typeratio === 'ange'
        ? world.angelbonus + palier.ratio
        : world.angelbonus;

    const marquerDebloque = (liste: Palier[]) =>
      liste.map((p) => (p.name === palier.name ? { ...p, unlocked: true } : p));

    this.world.set({
      ...world,
      products: produits,
      angelbonus,
      money: monnaie === 'money' ? world.money - palier.seuil : world.money,
      activeangels:
        monnaie === 'activeangels'
          ? world.activeangels - palier.seuil
          : world.activeangels,
      allunlocks: source.kind === 'allunlock' ? marquerDebloque(world.allunlocks) : world.allunlocks,
      upgrades: source.kind === 'upgrade' ? marquerDebloque(world.upgrades) : world.upgrades,
      angelupgrades:
        source.kind === 'angelupgrade' ? marquerDebloque(world.angelupgrades) : world.angelupgrades,
    });

    this.notify(`${palier.name} unlocked!`);
    // BMO bipe quand un palier de quantité (unlock) se débloque
    if (source.kind === 'productPalier' || source.kind === 'allunlock') {
      this.sons.jouer('bmo');
    }
  }

  private async mutate<TData, TVariables extends object>(
    document: TypedDocumentNode<TData, TVariables>,
    variables: TVariables,
  ): Promise<void> {
    try {
      await firstValueFrom(
        this.apollo.mutate<TData, TVariables>({ mutation: document, variables }),
      );
      this.acheterProduitsError.set(false);
    } catch {
      this.acheterProduitsError.set(true);
      // Pas de getWorld ici : en dehors du chargement, du bouton Refresh, du
      // reset et du total d'anges (Investors), le client ne recharge pas le
      // monde complet. Le serveur reprend la main au prochain Refresh.
      this.notify('Action rejected by the server');
    }
  }
}

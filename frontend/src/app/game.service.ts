import { Injectable, signal } from '@angular/core';
import { Apollo, TypedDocumentNode } from 'apollo-angular';
import { firstValueFrom } from 'rxjs';
import {
  ACHETER_ANGEL_UPGRADE_MUTATION,
  ACHETER_CASH_UPGRADE_MUTATION,
  ACHETER_QT_PRODUIT_MUTATION,
  ENGAGER_MANAGER_MUTATION,
  GET_WORLD_QUERY,
  LANCER_PRODUCTION_PRODUIT_MUTATION,
  RESET_WORLD_MUTATION,
} from './graphql/queries';
import { Palier, Product, RatioType, World } from './graphql/types';

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
  readonly server = signal('http://localhost:3000');

  readonly user = signal(this.initUsername());

  readonly world = signal<World | undefined>(undefined);

  readonly snackmessage = signal('');

  // x1 -> x10 -> x100 -> Max -> x1 ...
  readonly qtmulti = signal<'x1' | 'x10' | 'x100' | 'Max'>('x1');

  readonly acheterProduitsError = signal(false);

  // Incrémenté à chaque rechargement du monde depuis le serveur : les
  // produits s'en servent pour abandonner leurs productions en cours, qui
  // ne correspondent plus à l'état serveur (reset, changement de joueur).
  readonly worldVersion = signal(0);

  constructor(private apollo: Apollo) {
    this.refreshWorld();
  }

  private initUsername(): string {
    let username = localStorage.getItem('username');
    if (!username) {
      username = 'Captain' + Math.floor(Math.random() * 10000);
    }
    return username;
  }

  commitName(name: string) {
    localStorage.setItem('username', name);
    this.user.set(name);
    this.refreshWorld();
  }

  async refreshWorld() {
    try {
      const { data } = await firstValueFrom(
        this.apollo.query<{ getWorld: World }, { user: string }>({
          query: GET_WORLD_QUERY,
          variables: { user: this.user() },
          fetchPolicy: 'network-only',
        }),
      );
      if (!data) throw new Error('Réponse vide du serveur');
      this.world.set(data.getWorld);
      this.worldVersion.update((v) => v + 1);
    } catch {
      this.snackmessage.set(
        'Erreur de communication avec le serveur pour charger le monde',
      );
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
    await this.mutate(LANCER_PRODUCTION_PRODUIT_MUTATION, {
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
    this.checkUnlocks(product.id);

    await this.mutate(ACHETER_QT_PRODUIT_MUTATION, {
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
    this.snackmessage.set(`${manager.name} a rejoint votre équipe !`);

    await this.mutate(ENGAGER_MANAGER_MUTATION, {
      user: this.user(),
      name: manager.name,
    });
  }

  async buyCashUpgrade(upgrade: Palier) {
    const world = this.world();
    if (!world || world.money < upgrade.seuil || upgrade.unlocked) return;

    this.applyUpgrade(upgrade, { kind: 'upgrade' }, 'money');
    await this.mutate(ACHETER_CASH_UPGRADE_MUTATION, {
      user: this.user(),
      name: upgrade.name,
    });
  }

  async buyAngelUpgrade(upgrade: Palier) {
    const world = this.world();
    if (!world || world.activeangels < upgrade.seuil || upgrade.unlocked) return;

    this.applyUpgrade(upgrade, { kind: 'angelupgrade' }, 'activeangels');
    await this.mutate(ACHETER_ANGEL_UPGRADE_MUTATION, {
      user: this.user(),
      name: upgrade.name,
    });
  }

  async resetWorld() {
    await this.mutate(RESET_WORLD_MUTATION, { user: this.user() });
    await this.refreshWorld();
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
        palier.typeratio === RatioType.vitesse &&
        (palier.idcible === 0 || p.id === palier.idcible)
      ) {
        mis_a_jour = { ...mis_a_jour, vitesse: mis_a_jour.vitesse / palier.ratio };
      }
      if (
        palier.typeratio === RatioType.gain &&
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

    const angelbonus =
      palier.typeratio === RatioType.ange
        ? world.angelbonus * palier.ratio
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

    this.snackmessage.set(`${palier.name} débloqué !`);
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
      this.snackmessage.set('Erreur de transmission au serveur');
    }
  }
}

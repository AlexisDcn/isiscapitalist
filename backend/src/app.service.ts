import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { origworld } from './origworld.js';
import { World, Product, Palier, RatioType } from './graphql.js';
import { calcQtProductionforElapseTime } from './production.js';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }

  achatProduit(world: World, id: number, quantite: number): Product {
    const product = this.findProduct(world, id);

    // Le cout stocké sur le produit est toujours celui de la PROCHAINE unité.
    // On cumule le cout de chaque unité achetée en le faisant croitre à
    // chaque itération du taux de croissance du produit.
    let coutUnitaire = product.cout;
    let coutTotal = 0;
    for (let i = 0; i < quantite; i++) {
      coutTotal += coutUnitaire;
      coutUnitaire *= product.croissance;
    }

    if (world.money < coutTotal) {
      throw new Error(
        `Argent insuffisant pour acheter ${quantite} ${product.name} (coût ${coutTotal}, argent disponible ${world.money})`,
      );
    }

    world.money -= coutTotal;
    product.quantite += quantite;
    product.cout = coutUnitaire;

    this.checkProductUnlocks(world, product);
    this.checkAllUnlocks(world);

    return product;
  }

  lancerProduction(world: World, id: number): Product {
    const product = this.findProduct(world, id);
    product.timeleft = product.vitesse;
    return product;
  }

  engagerManager(world: World, name: string): Palier {
    const manager = this.findManager(world, name);

    if (manager.unlocked) {
      throw new Error(`Le manager ${name} est déjà engagé`);
    }
    if (world.money < manager.seuil) {
      throw new Error(
        `Argent insuffisant pour engager ${name} (coût ${manager.seuil}, argent disponible ${world.money})`,
      );
    }

    const product = this.findProduct(world, manager.idcible);
    world.money -= manager.seuil;
    manager.unlocked = true;
    product.managerUnlocked = true;

    return manager;
  }

  acheterCashUpgrade(world: World, name: string): Palier {
    return this.acheterUpgrade(world, world.upgrades, name, 'money');
  }

  acheterAngelUpgrade(world: World, name: string): Palier {
    return this.acheterUpgrade(world, world.angelupgrades, name, 'activeangels');
  }

  // Logique commune à acheterCashUpgrade et acheterAngelUpgrade : seule la
  // monnaie dépensée (argent ou anges actifs) change.
  private acheterUpgrade(
    world: World,
    upgrades: Palier[],
    name: string,
    monnaie: 'money' | 'activeangels',
  ): Palier {
    const upgrade = this.findUpgrade(upgrades, name);

    if (upgrade.unlocked) {
      throw new Error(`L'amélioration ${name} est déjà débloquée`);
    }
    if (world[monnaie] < upgrade.seuil) {
      const nomMonnaie = monnaie === 'money' ? 'Argent' : 'Anges';
      throw new Error(
        `${nomMonnaie} insuffisant pour débloquer ${name} (coût ${upgrade.seuil}, disponible ${world[monnaie]})`,
      );
    }

    world[monnaie] -= upgrade.seuil;
    upgrade.unlocked = true;
    this.applyPalierBonus(world, upgrade);

    return upgrade;
  }

  private findUpgrade(upgrades: Palier[], name: string): Palier {
    const upgrade = upgrades.find((u) => u.name === name);
    if (!upgrade) {
      throw new Error(`L'amélioration ${name} n'existe pas`);
    }
    return upgrade;
  }

  resetWorld(world: World): World {
    const angesGagnes = this.calculerAngesGagnes(world);

    // On repart du monde d'origine (produits, unlocks, upgrades, managers
    // tous reinitialises), en ne conservant que le score et les compteurs
    // d'anges, comme demande par le sujet.
    const nouveauMonde: World = structuredClone(origworld);
    nouveauMonde.score = world.score;
    nouveauMonde.totalangels = world.totalangels + angesGagnes;
    nouveauMonde.activeangels = world.activeangels + angesGagnes;
    nouveauMonde.lastupdate = this.now();

    return nouveauMonde;
  }

  // Formule officielle (sujet frontend) : le nombre d'anges SUPPLEMENTAIRES
  // gagnes par la partie en cours est 150 * sqrt(gains cumules / 10^15) -
  // totalangels, "gains cumules" etant le score (jamais decremente). On
  // borne a 0 : le score n'a pas assez progresse depuis le dernier reset
  // pour justifier de nouveaux anges.
  private calculerAngesGagnes(world: World): number {
    const angesTheoriques = Math.floor(
      150 * Math.sqrt(world.score / 1_000_000_000_000_000),
    );
    return Math.max(0, angesTheoriques - world.totalangels);
  }

  private findProduct(world: World, id: number): Product {
    const product = world.products.find((p) => p.id === id);
    if (!product) {
      throw new Error(`Le produit avec l'id ${id} n'existe pas`);
    }
    return product;
  }

  private findManager(world: World, name: string): Palier {
    const manager = world.managers.find((m) => m.name === name);
    if (!manager) {
      throw new Error(`Le manager ${name} n'existe pas`);
    }
    return manager;
  }

  private checkProductUnlocks(world: World, product: Product) {
    for (const palier of product.paliers) {
      if (!palier.unlocked && product.quantite >= palier.seuil) {
        palier.unlocked = true;
        this.applyPalierBonus(world, palier);
      }
    }
  }

  private checkAllUnlocks(world: World) {
    const quantiteMin = Math.min(...world.products.map((p) => p.quantite));
    for (const palier of world.allunlocks) {
      if (!palier.unlocked && quantiteMin >= palier.seuil) {
        palier.unlocked = true;
        this.applyPalierBonus(world, palier);
      }
    }
  }

  private applyPalierBonus(world: World, palier: Palier) {
    switch (palier.typeratio) {
      case RatioType.vitesse:
        this.forEachTargetProduct(world, palier.idcible, (product) => {
          product.vitesse = product.vitesse / palier.ratio;
        });
        break;
      case RatioType.gain:
        this.forEachTargetProduct(world, palier.idcible, (product) => {
          product.revenu = product.revenu * palier.ratio;
        });
        break;
      case RatioType.ange:
        world.angelbonus = world.angelbonus * palier.ratio;
        break;
    }
  }

  private forEachTargetProduct(
    world: World,
    idcible: number,
    effect: (product: Product) => void,
  ) {
    if (idcible === 0) {
      world.products.forEach(effect);
      return;
    }
    const product = world.products.find((p) => p.id === idcible);
    if (product) {
      effect(product);
    }
  }

  readUserWorld(user: string): World {
    try {
      const data = fs.readFileSync(
        path.join(process.cwd(), 'userworlds/', user + '-world.json'),
      );
      const world: World = JSON.parse(data.toString());
      this.evolveWorld(world);
      return world;
    } catch (e: unknown) {
      console.log((e as Error).message);
      // structuredClone : origworld est un module partagé par tous les
      // utilisateurs, il ne faut jamais le muter directement (sinon les
      // achats du premier joueur sans sauvegarde pollueraient le monde
      // d'origine de tous les autres).
      const world: World = structuredClone(origworld);
      // Monde tout juste créé : rien n'a encore pu se produire, on part de
      // maintenant plutôt que de calculer une évolution depuis l'epoch 0.
      world.lastupdate = this.now();
      return world;
    }
  }

  // Calcule la production automatique de chaque produit depuis la dernière
  // mise à jour du monde et l'ajoute à l'argent et au score, puis
  // repositionne lastupdate sur l'instant courant.
  //
  // lastupdate est un timestamp en millisecondes transporté sous forme de
  // chaine (type String! du schéma, commun à tous les serveurs) : un entier
  // GraphQL 32 bits ne pourrait pas le contenir.
  private evolveWorld(world: World): void {
    const now = Date.now();
    const elapseTime = Math.max(0, now - Number(world.lastupdate));

    if (elapseTime > 0) {
      for (const product of world.products) {
        const qt = calcQtProductionforElapseTime(product, elapseTime);
        if (qt > 0) {
          const gain = qt * this.calculerGainProduit(world, product);
          world.money += gain;
          world.score += gain;
        }
      }
    }

    world.lastupdate = String(now);
  }

  private calculerGainProduit(world: World, product: Product): number {
    return (
      product.quantite *
      product.revenu *
      (1 + (world.activeangels * world.angelbonus) / 100)
    );
  }

  private now(): string {
    return String(Date.now());
  }

  saveWorld(user: string, world: World) {
    fs.writeFile(
      path.join(process.cwd(), 'userworlds/', user + '-world.json'),
      JSON.stringify(world),
      (err) => {
        if (err) {
          console.error(err);
          throw new Error(`Erreur d'écriture du monde coté serveur`);
        }
      },
    );
  }
}

import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { origworld } from './origworld.js';
import { World, Product, Palier, RatioType } from './graphql.js';

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

  private findProduct(world: World, id: number): Product {
    const product = world.products.find((p) => p.id === id);
    if (!product) {
      throw new Error(`Le produit avec l'id ${id} n'existe pas`);
    }
    return product;
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
      return JSON.parse(data.toString());
    } catch (e: unknown) {
      console.log((e as Error).message);
      return origworld;
    }
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

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { AppService } from './app.service.js';
import { World, RatioType } from './graphql.js';
import { origworld } from './origworld.js';

function makeWorld(overrides: Partial<World> = {}): World {
  return {
    name: 'Monde de test',
    logo: '',
    money: 0,
    score: 0,
    totalangels: 0,
    activeangels: 0,
    angelbonus: 2,
    lastupdate: String(Date.now()),
    products: [
      {
        id: 1,
        name: 'Produit A',
        logo: '',
        cout: 10,
        croissance: 1.1,
        revenu: 5,
        vitesse: 1000,
        quantite: 0,
        timeleft: 0,
        managerUnlocked: false,
        paliers: [
          {
            name: 'Palier A1',
            logo: '',
            seuil: 5,
            idcible: 1,
            ratio: 2,
            typeratio: RatioType.vitesse,
            unlocked: false,
          },
        ],
      },
      {
        id: 2,
        name: 'Produit B',
        logo: '',
        cout: 100,
        croissance: 1.2,
        revenu: 50,
        vitesse: 2000,
        quantite: 0,
        timeleft: 0,
        managerUnlocked: false,
        paliers: [],
      },
    ],
    allunlocks: [
      {
        name: 'Allunlock global',
        logo: '',
        seuil: 3,
        idcible: 0,
        ratio: 2,
        typeratio: RatioType.gain,
        unlocked: false,
      },
    ],
    upgrades: [
      {
        name: 'Upgrade Cash',
        logo: '',
        seuil: 100,
        idcible: 1,
        ratio: 3,
        typeratio: RatioType.gain,
        unlocked: false,
      },
    ],
    angelupgrades: [
      {
        name: 'Upgrade Angel',
        logo: '',
        seuil: 5,
        idcible: 0,
        ratio: 3,
        typeratio: RatioType.gain,
        unlocked: false,
      },
    ],
    managers: [
      {
        name: 'Manager A',
        logo: '',
        seuil: 50,
        idcible: 1,
        ratio: 0,
        typeratio: RatioType.gain,
        unlocked: false,
      },
    ],
    ...overrides,
  };
}

describe('AppService', () => {
  let service: AppService;

  beforeEach(() => {
    service = new AppService();
  });

  describe('achatProduit', () => {
    it("lève une erreur si le produit n'existe pas", () => {
      const world = makeWorld();
      expect(() => service.achatProduit(world, 999, 1)).toThrow(
        "Le produit avec l'id 999 n'existe pas",
      );
    });

    it("lève une erreur si l'argent est insuffisant et ne modifie rien", () => {
      const world = makeWorld({ money: 5 });
      expect(() => service.achatProduit(world, 1, 1)).toThrow(/insuffisant/);
      expect(world.money).toBe(5);
      expect(world.products[0].quantite).toBe(0);
    });

    it('achète la quantité demandée, déduit le coût cumulé et met à jour le coût suivant', () => {
      const world = makeWorld({ money: 1000 });
      // coût cumulé pour 3 unités à 10, croissance 1.1 : 10 + 11 + 12.1 = 33.1
      const product = service.achatProduit(world, 1, 3);

      expect(product.quantite).toBe(3);
      expect(world.money).toBeCloseTo(1000 - 33.1, 6);
      expect(product.cout).toBeCloseTo(10 * 1.1 ** 3, 6);
    });

    it('débloque un palier de produit et applique son bonus vitesse quand le seuil est atteint', () => {
      const world = makeWorld({ money: 1000 });
      const product = service.achatProduit(world, 1, 5); // seuil du palier A1 = 5

      expect(product.paliers[0].unlocked).toBe(true);
      // typeratio vitesse, ratio 2 : la vitesse est divisée par 2
      expect(product.vitesse).toBe(500);
    });

    it("ne débloque pas un palier tant que le seuil n'est pas atteint", () => {
      const world = makeWorld({ money: 1000 });
      const product = service.achatProduit(world, 1, 4);

      expect(product.paliers[0].unlocked).toBe(false);
      expect(product.vitesse).toBe(1000);
    });

    it('débloque un allunlock quand tous les produits atteignent son seuil', () => {
      const world = makeWorld({ money: 100_000 });
      service.achatProduit(world, 1, 3);
      service.achatProduit(world, 2, 3); // les deux produits atteignent 3

      expect(world.allunlocks[0].unlocked).toBe(true);
      // ratio 2, typeratio gain, idcible 0 -> tous les produits
      expect(world.products[0].revenu).toBe(10);
      expect(world.products[1].revenu).toBe(100);
    });
  });

  describe('lancerProduction', () => {
    it('positionne timeleft à la vitesse du produit', () => {
      const world = makeWorld();
      const product = service.lancerProduction(world, 1);
      expect(product.timeleft).toBe(1000);
    });

    it("lève une erreur si le produit n'existe pas", () => {
      const world = makeWorld();
      expect(() => service.lancerProduction(world, 999)).toThrow(
        "n'existe pas",
      );
    });
  });

  describe('engagerManager', () => {
    it('déduit le coût et débloque le manager et le produit cible', () => {
      const world = makeWorld({ money: 100 });
      const manager = service.engagerManager(world, 'Manager A');

      expect(manager.unlocked).toBe(true);
      expect(world.money).toBe(50);
      expect(world.products[0].managerUnlocked).toBe(true);
    });

    it('lève une erreur si les fonds sont insuffisants', () => {
      const world = makeWorld({ money: 10 });
      expect(() => service.engagerManager(world, 'Manager A')).toThrow(
        /insuffisant/,
      );
      expect(world.managers[0].unlocked).toBe(false);
    });

    it('lève une erreur si le manager est déjà engagé', () => {
      const world = makeWorld({ money: 1000 });
      service.engagerManager(world, 'Manager A');
      expect(() => service.engagerManager(world, 'Manager A')).toThrow(
        /déjà engagé/,
      );
    });

    it('lève une erreur si le nom est inconnu', () => {
      const world = makeWorld({ money: 1000 });
      expect(() => service.engagerManager(world, 'Inconnu')).toThrow(
        "n'existe pas",
      );
    });
  });

  describe('acheterCashUpgrade', () => {
    it('déduit son coût en argent et applique son bonus', () => {
      const world = makeWorld({ money: 100 });
      const upgrade = service.acheterCashUpgrade(world, 'Upgrade Cash');

      expect(upgrade.unlocked).toBe(true);
      expect(world.money).toBe(0);
      // ratio 3, gain, idcible 1 (produit A)
      expect(world.products[0].revenu).toBe(15);
    });

    it('lève une erreur si le solde est insuffisant', () => {
      const world = makeWorld({ money: 10 });
      expect(() =>
        service.acheterCashUpgrade(world, 'Upgrade Cash'),
      ).toThrow(/insuffisant/);
    });

    it('lève une erreur si déjà débloqué', () => {
      const world = makeWorld({ money: 1000 });
      service.acheterCashUpgrade(world, 'Upgrade Cash');
      expect(() =>
        service.acheterCashUpgrade(world, 'Upgrade Cash'),
      ).toThrow(/déjà débloquée/);
    });
  });

  describe('acheterAngelUpgrade', () => {
    it('déduit son coût en anges actifs (pas en argent) et applique son bonus', () => {
      const world = makeWorld({ activeangels: 10, money: 500 });
      const upgrade = service.acheterAngelUpgrade(world, 'Upgrade Angel');

      expect(upgrade.unlocked).toBe(true);
      expect(world.activeangels).toBe(5);
      expect(world.money).toBe(500); // l'argent n'est pas touché
      // ratio 3, gain, idcible 0 -> tous les produits
      expect(world.products[0].revenu).toBe(15);
      expect(world.products[1].revenu).toBe(150);
    });

    it("un bonus de type ange AJOUTE ratio au bonus des anges (interopérabilité)", () => {
      const world = makeWorld({ activeangels: 10, angelbonus: 2 });
      world.angelupgrades[0] = {
        name: 'Efficacité',
        logo: '',
        seuil: 5,
        idcible: -1,
        ratio: 3,
        typeratio: RatioType.ange,
        unlocked: false,
      };
      service.acheterAngelUpgrade(world, 'Efficacité');
      expect(world.angelbonus).toBe(5); // 2 + 3, et non 2 * 3
    });

    it("lève une erreur si les anges actifs sont insuffisants", () => {
      const world = makeWorld({ activeangels: 1 });
      expect(() =>
        service.acheterAngelUpgrade(world, 'Upgrade Angel'),
      ).toThrow(/insuffisant/);
    });
  });

  describe('resetWorld', () => {
    it('conserve le score et réinitialise le reste comme le monde d\'origine', () => {
      // resetWorld repart toujours du vrai origworld (thème du jeu), pas du
      // fixture de test : on compare donc aux valeurs d'origworld lui-même.
      const world = makeWorld({ money: 5000, score: 42 });
      world.products[0].quantite = 999;
      world.products[0].paliers[0].unlocked = true;

      const nouveauMonde = service.resetWorld(world);

      expect(nouveauMonde.score).toBe(42);
      expect(nouveauMonde.money).toBe(origworld.money);
      expect(nouveauMonde.products[0].quantite).toBe(
        origworld.products[0].quantite,
      );
      expect(
        nouveauMonde.products[0].paliers[0].unlocked,
      ).toBe(origworld.products[0].paliers[0].unlocked);
    });

    it('tous les anges gagnés deviennent actifs, moins ceux déjà dépensés', () => {
      // score = 4 * 10^15 -> 150 * sqrt(4) = 300 anges au total
      const world = makeWorld({
        score: 4_000_000_000_000_000,
        totalangels: 300,
        activeangels: 1,
      });
      // 2 anges ont déjà été dépensés dans un angel upgrade acheté
      world.angelupgrades[0].seuil = 2;
      world.angelupgrades[0].unlocked = true;

      const nouveauMonde = service.resetWorld(world);

      expect(nouveauMonde.totalangels).toBe(300);
      expect(nouveauMonde.activeangels).toBe(298);
    });

    it("recalcule le total d'anges à partir du score même si totalangels est en retard", () => {
      const world = makeWorld({ score: 4_000_000_000_000_000, totalangels: 3 });
      const nouveauMonde = service.resetWorld(world);

      expect(nouveauMonde.totalangels).toBe(300);
      expect(nouveauMonde.activeangels).toBe(300);
    });

    it("ne fait jamais baisser le total d'anges si le score est faible", () => {
      const world = makeWorld({ score: 0, totalangels: 50, activeangels: 10 });
      world.angelupgrades[0].seuil = 40;
      world.angelupgrades[0].unlocked = true;
      const nouveauMonde = service.resetWorld(world);

      expect(nouveauMonde.totalangels).toBe(50);
      expect(nouveauMonde.activeangels).toBe(10);
    });

    it('conserve les angel upgrades achetés et réapplique leur bonus', () => {
      const origine = origworld.angelupgrades[0];
      const world = makeWorld({ score: 4_000_000_000_000_000, totalangels: 300 });
      world.angelupgrades = [{ ...origine, unlocked: true }];

      const nouveauMonde = service.resetWorld(world);

      expect(
        nouveauMonde.angelupgrades.find((u) => u.name === origine.name)?.unlocked,
      ).toBe(true);
      // le bonus (revenus x ratio) est réappliqué sur le monde remis à zéro
      expect(nouveauMonde.products[0].revenu).toBe(
        origworld.products[0].revenu * origine.ratio,
      );
    });
  });

  describe('readUserWorld', () => {
    const userworldsDir = path.join(process.cwd(), 'userworlds');

    afterEach(() => {
      // Ne laisse aucun fichier de test derriere soi.
      for (const f of fs.readdirSync(userworldsDir)) {
        if (f.startsWith('__vitest__')) {
          fs.unlinkSync(path.join(userworldsDir, f));
        }
      }
    });

    it("ne mute jamais le monde d'origine partagé entre joueurs", () => {
      const world1 = service.readUserWorld('__vitest__joueur1__');
      world1.money = 99999;
      world1.products[0].quantite = 42;

      const world2 = service.readUserWorld('__vitest__joueur2__');

      expect(world2.money).toBe(0);
      expect(world2.products[0].quantite).toBe(1);
      // les deux mondes sont bien des objets distincts
      expect(world2).not.toBe(world1);
    });

    it("initialise lastupdate à l'instant présent pour un monde tout juste créé", () => {
      const avant = Date.now();
      const world = service.readUserWorld('__vitest__joueur3__');
      const apres = Date.now();

      expect(Number(world.lastupdate)).toBeGreaterThanOrEqual(avant);
      expect(Number(world.lastupdate)).toBeLessThanOrEqual(apres);
      // pas de gain aberrant calcule depuis l'epoch 0
      expect(world.money).toBe(0);
      expect(world.score).toBe(0);
    });

    it("relit immédiatement ce qui vient d'être sauvegardé (pas de mise à jour perdue)", () => {
      for (let i = 1; i <= 50; i++) {
        const w = service.readUserWorld('__vitest__joueur5__');
        w.money = i;
        service.saveWorld('__vitest__joueur5__', w);
      }
      expect(service.readUserWorld('__vitest__joueur5__').money).toBe(50);
    });

    it('tient totalangels à jour en direct avec le score (formule côté serveur)', () => {
      const world = makeWorld({ score: 4_000_000_000_000_000, totalangels: 0 });
      fs.writeFileSync(
        path.join(userworldsDir, '__vitest__joueur6__-world.json'),
        JSON.stringify(world),
      );

      expect(service.readUserWorld('__vitest__joueur6__').totalangels).toBe(300);
    });

    it('calcule la production écoulée depuis lastupdate pour un monde sauvegardé', () => {
      const world = makeWorld({ money: 0, score: 0 });
      world.products[0].timeleft = 500; // en cours de production
      world.lastupdate = String(Date.now() - 1000); // il y a 1s (1000ms)

      fs.writeFileSync(
        path.join(userworldsDir, '__vitest__joueur4__-world.json'),
        JSON.stringify(world),
      );

      const resultat = service.readUserWorld('__vitest__joueur4__');

      // 1000ms écoulées >= timeleft (500) : une production s'est terminée
      // gain = quantite(0) * revenu(5) * (1 + 0) = 0 (personne ne possede le
      // produit), mais le timeleft doit bien retomber a 0.
      expect(resultat.products[0].timeleft).toBe(0);
    });
  });
});

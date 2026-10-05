import { TestBed } from '@angular/core/testing';
import { Apollo } from 'apollo-angular';
import { of } from 'rxjs';
import { GameService } from './game.service';
import { Palier, Product, World } from './graphql/schema-types';

function palier(over: Partial<Palier> = {}): Palier {
  return {
    name: 'Palier',
    logo: '',
    seuil: 5,
    idcible: 1,
    ratio: 2,
    typeratio: 'vitesse',
    unlocked: false,
    ...over,
  };
}

function produit(over: Partial<Product> = {}): Product {
  return {
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
    paliers: [palier({ name: 'Palier A1', seuil: 5, idcible: 1 })],
    ...over,
  };
}

function monde(over: Partial<World> = {}): World {
  return {
    name: 'Test',
    logo: '',
    money: 0,
    score: 0,
    totalangels: 0,
    activeangels: 0,
    angelbonus: 2,
    lastupdate: '0',
    products: [produit(), produit({ id: 2, name: 'Produit B', paliers: [] })],
    allunlocks: [palier({ name: 'Global', seuil: 3, idcible: 0, typeratio: 'gain' })],
    upgrades: [palier({ name: 'Cash', seuil: 100, idcible: 1, ratio: 3, typeratio: 'gain' })],
    angelupgrades: [palier({ name: 'Angel', seuil: 5, idcible: 0, ratio: 3, typeratio: 'gain' })],
    managers: [palier({ name: 'Manager A', seuil: 50, idcible: 1, ratio: 0, typeratio: 'gain' })],
    ...over,
  };
}

describe('GameService', () => {
  let service: GameService;
  let mutations: unknown[];

  function creer(world: World) {
    mutations = [];
    TestBed.configureTestingModule({
      providers: [
        {
          provide: Apollo,
          useValue: {
            query: () => of({ data: { getWorld: world } }),
            mutate: (opts: { variables: unknown }) => {
              mutations.push(opts.variables);
              return of({ data: {} });
            },
          },
        },
      ],
    });
    service = TestBed.inject(GameService);
  }

  async function chargerMonde(world: World) {
    creer(world);
    await service.refreshWorld();
  }

  beforeEach(() => localStorage.clear());

  it('charge le monde depuis le serveur', async () => {
    await chargerMonde(monde());
    expect(service.world()?.name).toBe('Test');
  });

  describe('coutTotal et canBuy', () => {
    it('cumule le cout de chaque exemplaire avec la croissance', async () => {
      await chargerMonde(monde());
      const p = service.world()!.products[0];
      expect(service.coutTotal(p, 3)).toBeCloseTo(10 + 11 + 12.1, 6);
    });

    it("refuse l'achat quand l'argent est insuffisant, quel que soit le mode", async () => {
      await chargerMonde(monde({ money: 5 }));
      const p = service.world()!.products[0];
      for (let i = 0; i < 4; i++) {
        expect(service.canBuy(p)).toBe(false);
        service.cycleQtMulti();
      }
    });

    it("autorise l'achat quand l'argent suffit", async () => {
      await chargerMonde(monde({ money: 10 }));
      expect(service.canBuy(service.world()!.products[0])).toBe(true);
    });

    it('en mode Max, calcule la quantite maximale achetable', async () => {
      await chargerMonde(monde({ money: 33.1 })); // 10 + 11 + 12.1 = 33.1
      const p = service.world()!.products[0];
      service.cycleQtMulti(); // x10
      service.cycleQtMulti(); // x100
      service.cycleQtMulti(); // Max
      expect(service.numberToBuy(p)).toBe(3);
    });
  });

  describe('buyProduct', () => {
    it("n'achete rien et ne contacte pas le serveur si l'argent manque", async () => {
      await chargerMonde(monde({ money: 5 }));
      await service.buyProduct(1, service.world()!.products[0]);
      expect(service.world()!.money).toBe(5);
      expect(service.world()!.products[0].quantite).toBe(0);
      expect(mutations.length).toBe(0);
    });

    it('deduit le cout, augmente la quantite et le cout suivant, et previent le serveur', async () => {
      await chargerMonde(monde({ money: 1000 }));
      await service.buyProduct(3, service.world()!.products[0]);

      const w = service.world()!;
      expect(w.products[0].quantite).toBe(3);
      expect(w.money).toBeCloseTo(1000 - 33.1, 6);
      expect(w.products[0].cout).toBeCloseTo(10 * 1.1 ** 3, 6);
      expect(mutations).toEqual([{ user: service.user(), id: 1, quantite: 3 }]);
    });

    it('debloque un palier de produit et divise la vitesse', async () => {
      await chargerMonde(monde({ money: 10000 }));
      await service.buyProduct(5, service.world()!.products[0]);

      const p = service.world()!.products[0];
      expect(p.paliers[0].unlocked).toBe(true);
      expect(p.vitesse).toBe(500);
    });

    it('debloque un allunlock quand tous les produits atteignent le seuil', async () => {
      await chargerMonde(monde({ money: 100000 }));
      await service.buyProduct(3, service.world()!.products[0]);
      await service.buyProduct(3, service.world()!.products[1]);

      const w = service.world()!;
      expect(w.allunlocks[0].unlocked).toBe(true);
      expect(w.products[0].revenu).toBe(10); // x2
      expect(w.products[1].revenu).toBe(10); // 5 x2
    });
  });

  describe('productionDone', () => {
    it("credite argent et score avec le bonus d'anges actifs", async () => {
      await chargerMonde(monde({ activeangels: 10 })); // bonus 1 + 10*2/100 = 1.2
      const p = { ...service.world()!.products[0], quantite: 2 };
      service.productionDone(p, 1);

      expect(service.world()!.money).toBeCloseTo(5 * 2 * 1.2, 6);
      expect(service.world()!.score).toBeCloseTo(5 * 2 * 1.2, 6);
    });
  });

  describe('hireManager', () => {
    it('deduit le cout et debloque le manager et le produit', async () => {
      await chargerMonde(monde({ money: 100 }));
      await service.hireManager(service.world()!.managers[0]);

      const w = service.world()!;
      expect(w.money).toBe(50);
      expect(w.managers[0].unlocked).toBe(true);
      expect(w.products[0].managerUnlocked).toBe(true);
    });

    it("refuse d'engager un manager sans argent suffisant", async () => {
      await chargerMonde(monde({ money: 10 }));
      await service.hireManager(service.world()!.managers[0]);

      expect(service.world()!.managers[0].unlocked).toBe(false);
      expect(mutations.length).toBe(0);
    });
  });

  describe('upgrades', () => {
    it("un cash upgrade deduit l'argent et multiplie le revenu du produit cible", async () => {
      await chargerMonde(monde({ money: 100 }));
      await service.buyCashUpgrade(service.world()!.upgrades[0]);

      const w = service.world()!;
      expect(w.money).toBe(0);
      expect(w.upgrades[0].unlocked).toBe(true);
      expect(w.products[0].revenu).toBe(15);
      expect(w.products[1].revenu).toBe(5);
    });

    it("un angel upgrade deduit les anges actifs, pas l'argent", async () => {
      await chargerMonde(monde({ activeangels: 10, money: 500 }));
      await service.buyAngelUpgrade(service.world()!.angelupgrades[0]);

      const w = service.world()!;
      expect(w.activeangels).toBe(5);
      expect(w.money).toBe(500);
      expect(w.products[0].revenu).toBe(15);
      expect(w.products[1].revenu).toBe(15);
    });

    it("refuse un upgrade deja debloque ou trop cher", async () => {
      await chargerMonde(monde({ money: 10 }));
      await service.buyCashUpgrade(service.world()!.upgrades[0]);
      expect(service.world()!.upgrades[0].unlocked).toBe(false);
      expect(mutations.length).toBe(0);
    });
  });
});

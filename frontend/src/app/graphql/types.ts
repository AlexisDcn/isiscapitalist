// Types miroirs du schéma GraphQL du backend (backend/src/schema.graphql).
// Écrits à la main plutôt que générés par codegen pour garder le projet
// simple ; s'ils divergent du schéma serveur, ajustez-les ici.

export enum RatioType {
  gain = 'gain',
  vitesse = 'vitesse',
  ange = 'ange',
}

export interface Palier {
  name: string;
  logo: string;
  seuil: number;
  idcible: number;
  ratio: number;
  typeratio: RatioType;
  unlocked: boolean;
}

export interface Product {
  id: number;
  name: string;
  logo: string;
  cout: number;
  croissance: number;
  revenu: number;
  vitesse: number;
  quantite: number;
  timeleft: number;
  managerUnlocked: boolean;
  paliers: Palier[];
}

export interface World {
  name: string;
  logo: string;
  money: number;
  score: number;
  totalangels: number;
  activeangels: number;
  angelbonus: number;
  lastupdate: number;
  products: Product[];
  allunlocks: Palier[];
  upgrades: Palier[];
  angelupgrades: Palier[];
  managers: Palier[];
}

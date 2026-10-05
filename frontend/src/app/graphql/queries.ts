import { gql } from 'apollo-angular';
import { World } from './types';

export const GET_WORLD_QUERY = gql<{ getWorld: World }, { user: string }>`
  query getWorld($user: String!) {
    getWorld(user: $user) {
      name
      logo
      money
      score
      totalangels
      activeangels
      angelbonus
      lastupdate
      products {
        id
        name
        logo
        cout
        croissance
        revenu
        vitesse
        quantite
        timeleft
        managerUnlocked
        paliers {
          name
          logo
          seuil
          idcible
          ratio
          typeratio
          unlocked
        }
      }
      allunlocks {
        name
        logo
        seuil
        idcible
        ratio
        typeratio
        unlocked
      }
      upgrades {
        name
        logo
        seuil
        idcible
        ratio
        typeratio
        unlocked
      }
      angelupgrades {
        name
        logo
        seuil
        idcible
        ratio
        typeratio
        unlocked
      }
      managers {
        name
        logo
        seuil
        idcible
        ratio
        typeratio
        unlocked
      }
    }
  }
`;

export const ACHETER_QT_PRODUIT_MUTATION = gql<
  { acheterQtProduit: { id: number } },
  { user: string; id: number; quantite: number }
>`
  mutation acheterQtProduit($user: String!, $id: Int!, $quantite: Int!) {
    acheterQtProduit(user: $user, id: $id, quantite: $quantite) {
      id
    }
  }
`;

export const LANCER_PRODUCTION_PRODUIT_MUTATION = gql<
  { lancerProductionProduit: { id: number } },
  { user: string; id: number }
>`
  mutation lancerProductionProduit($user: String!, $id: Int!) {
    lancerProductionProduit(user: $user, id: $id) {
      id
    }
  }
`;

export const ENGAGER_MANAGER_MUTATION = gql<
  { engagerManager: { name: string } },
  { user: string; name: string }
>`
  mutation engagerManager($user: String!, $name: String!) {
    engagerManager(user: $user, name: $name) {
      name
    }
  }
`;

export const ACHETER_CASH_UPGRADE_MUTATION = gql<
  { acheterCashUpgrade: { name: string } },
  { user: string; name: string }
>`
  mutation acheterCashUpgrade($user: String!, $name: String!) {
    acheterCashUpgrade(user: $user, name: $name) {
      name
    }
  }
`;

export const ACHETER_ANGEL_UPGRADE_MUTATION = gql<
  { acheterAngelUpgrade: { name: string } },
  { user: string; name: string }
>`
  mutation acheterAngelUpgrade($user: String!, $name: String!) {
    acheterAngelUpgrade(user: $user, name: $name) {
      name
    }
  }
`;

export const RESET_WORLD_MUTATION = gql<
  { resetWorld: { name: string } },
  { user: string }
>`
  mutation resetWorld($user: String!) {
    resetWorld(user: $user) {
      name
    }
  }
`;

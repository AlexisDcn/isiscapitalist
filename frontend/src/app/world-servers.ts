import { signal } from '@angular/core';

export interface WorldServer {
  name: string;
  url: string;
}

// Serveurs de mondes connus. Tous exposent le même schéma GraphQL (point
// d'accès /graphql) et servent leurs images sous /icones, ce qui permet au
// même client de naviguer de l'un à l'autre.
export const KNOWN_WORLDS: WorldServer[] = [
  { name: 'The Land of Ooo (local)', url: 'http://localhost:3000' },
  { name: 'Nuka Capitalist', url: 'https://capitalist.lucaslopvet.fr' },
];

// Accepte « https://hote », « https://hote/ » ou « https://hote/graphql ».
export function normalizeServerUrl(url: string): string {
  return url
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/graphql$/i, '');
}

function initialServer(): string {
  try {
    const stocke = localStorage.getItem('server');
    if (stocke) return normalizeServerUrl(stocke);
  } catch {
    // stockage indisponible : on garde le serveur par défaut
  }
  return KNOWN_WORLDS[0].url;
}

// Adresse du serveur courant. Lue à chaque requête par le lien HTTP d'Apollo,
// ce qui permet de changer de monde sans recréer le client.
export const serverUrl = signal(initialServer());

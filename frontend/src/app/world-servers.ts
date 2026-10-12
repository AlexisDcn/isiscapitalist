import { signal } from '@angular/core';

export interface WorldServer {
  name: string;
  url: string;
}

// Mondes proposés au premier lancement. Tous exposent le même schéma GraphQL
// (point d'accès /graphql) et servent leurs images sous /icones, ce qui
// permet au même client de naviguer de l'un à l'autre.
export const DEFAULT_WORLDS: WorldServer[] = [
  { name: 'Adventure Time Capitalist (local)', url: 'http://localhost:3000' },
  { name: 'Nuka Capitalist', url: 'https://capitalist.lucaslopvet.fr' },
];

// Accepte « https://hote », « https://hote/ » ou « https://hote/graphql ».
export function normalizeServerUrl(url: string): string {
  return url
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/graphql$/i, '');
}

function lire(cle: string): string | null {
  try {
    return localStorage.getItem(cle);
  } catch {
    return null;
  }
}

function ecrire(cle: string, valeur: string) {
  try {
    localStorage.setItem(cle, valeur);
  } catch {
    // stockage indisponible : le choix ne sera juste pas mémorisé
  }
}

function initialWorlds(): WorldServer[] {
  try {
    const liste = JSON.parse(lire('worlds') ?? 'null');
    if (Array.isArray(liste) && liste.length > 0) return liste;
  } catch {
    // liste illisible : on repart des mondes par défaut
  }
  return DEFAULT_WORLDS;
}

// Liste des mondes enregistrés par le joueur (ajouts et suppressions
// mémorisés dans le navigateur).
export const worldList = signal<WorldServer[]>(initialWorlds());

export function saveWorldList(liste: WorldServer[]) {
  worldList.set(liste);
  ecrire('worlds', JSON.stringify(liste));
}

// Adresse du serveur courant. Lue à chaque requête par le lien HTTP d'Apollo,
// ce qui permet de changer de monde sans recréer le client.
// Une adresse mémorisée qui n'est plus dans la liste (monde supprimé, essai
// d'ajout interrompu) est abandonnée : le menu déroulant afficherait le premier
// monde sans qu'on puisse le resélectionner, et le jeu resterait bloqué.
function initialServer(): string {
  const memorise = normalizeServerUrl(lire('server') ?? '');
  const liste = worldList();
  if (liste.some((w) => w.url === memorise)) return memorise;
  return liste[0]?.url || DEFAULT_WORLDS[0].url;
}

export const serverUrl = signal(initialServer());

export function saveServerUrl(url: string) {
  serverUrl.set(url);
  ecrire('server', url);
}

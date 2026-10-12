import { Injectable, signal } from '@angular/core';

// Effets sonores du client, communs à tous les mondes (frontend/public/sounds).
// Un fichier absent est simplement ignoré.
const FICHIERS = {
  // Lemongrab : quand le joueur n'a pas les moyens d'acheter
  unacceptable: '/sounds/unacceptable.mp3',
  // BMO : quand un palier (unlock) se débloque
  bmo: '/sounds/bmo-beep.mp3',
} as const;

export type Son = keyof typeof FICHIERS;

@Injectable({ providedIn: 'root' })
export class SoundService {
  readonly actif = signal(this.lirePreference());

  private lirePreference(): boolean {
    try {
      return localStorage.getItem('sfx') !== 'off';
    } catch {
      return true;
    }
  }

  basculer() {
    this.actif.update((a) => !a);
    try {
      localStorage.setItem('sfx', this.actif() ? 'on' : 'off');
    } catch {
      // préférence non mémorisée
    }
  }

  jouer(son: Son) {
    if (!this.actif()) return;
    const audio = new Audio(FICHIERS[son]);
    audio.volume = 0.7;
    audio.play().catch(() => undefined);
  }
}

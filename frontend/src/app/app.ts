import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FormsModule } from '@angular/forms';
import { BigValuePipe } from './bigvalue-pipe';
import { GameService } from './game.service';
import { Palier } from './graphql/schema-types';
import { Produit } from './produit/produit';
import { SoundService } from './sound.service';

@Component({
  selector: 'app-root',
  imports: [FormsModule, NgTemplateOutlet, BigValuePipe, Produit],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  gameService = inject(GameService);
  sons = inject(SoundService);
  private snackBar = inject(MatSnackBar);

  // Position du commutateur d'achat (0 à 3) : Jake grossit à chaque cran.
  indexMulti = computed(() =>
    ['x1', 'x10', 'x100', 'Max'].indexOf(this.gameService.qtmulti()),
  );

  // Revenu par seconde des produits gérés par un manager, bonus d'anges compris.
  revenuParSeconde = computed(() => {
    const w = this.gameService.world();
    if (!w) return 0;
    const bonus = 1 + (w.activeangels * w.angelbonus) / 100;
    return w.products
      .filter((p) => p.managerUnlocked && p.quantite > 0)
      .reduce((s, p) => s + (p.revenu * p.quantite * bonus * 1000) / p.vitesse, 0);
  });

  // Clic sur un achat impossible : Lemongrab n'est pas content.
  refuserSi(impossible: boolean) {
    if (impossible) this.sons.jouer('unacceptable');
  }

  usernameDraft = this.gameService.user();

  // Une seule fenêtre ouverte à la fois : en ouvrir une ferme la précédente.
  modal = signal<'managers' | 'unlocks' | 'upgrades' | 'angels' | 'investors' | null>(null);

  // Nombre de managers / upgrades que le joueur peut s'offrir en ce moment.
  badgeManagers = computed(() => {
    const w = this.gameService.world();
    return w ? w.managers.filter((m) => !m.unlocked && w.money >= m.seuil).length : 0;
  });
  badgeUpgrades = computed(() => {
    const w = this.gameService.world();
    return w ? w.upgrades.filter((u) => !u.unlocked && w.money >= u.seuil).length : 0;
  });
  badgeAngelUpgrades = computed(() => {
    const w = this.gameService.world();
    return w
      ? w.angelupgrades.filter((u) => !u.unlocked && w.activeangels >= u.seuil).length
      : 0;
  });

  // Prochain palier (non débloqué) de chaque produit + paliers globaux.
  nextUnlocks = computed(() => {
    const w = this.gameService.world();
    if (!w) return [];
    const parProduit = w.products
      .map((p) => p.paliers.find((pal) => !pal.unlocked))
      .filter((pal): pal is Palier => !!pal);
    return [...parProduit, ...w.allunlocks.filter((u) => !u.unlocked)];
  });

  // Le client ne connaît pas la formule des anges : le serveur tient
  // totalangels à jour (total des anges gagnés avec le score actuel) et le
  // client le lit dans getWorld, obtenu à l'ouverture d'Investors.
  // Anges déjà dépensés = coût des angel upgrades achetés.
  angesDepenses = computed(() => {
    const w = this.gameService.world();
    return w
      ? w.angelupgrades.filter((u) => u.unlocked).reduce((s, u) => s + u.seuil, 0)
      : 0;
  });

  // Anges gagnés mais pas encore actifs : ils le deviennent au reset.
  angesAReclamer = computed(() => {
    const w = this.gameService.world();
    return w ? Math.max(0, w.totalangels - w.activeangels - this.angesDepenses()) : 0;
  });

  // Anges déjà obtenus lors des parties précédentes (actifs ou dépensés).
  angesObtenus = computed(() => {
    const w = this.gameService.world();
    return w ? w.activeangels + this.angesDepenses() : 0;
  });

  // La pièce d'or est une image du client (frontend/public) : elle s'affiche
  // quel que soit le monde ; si le fichier manque, on affiche un "$".
  coinKo = signal(false);

  ajoutMonde = signal(false);
  urlSaisie = '';

  // Musique de fond commune à tous les mondes (frontend/public/music.mp3).
  // Les navigateurs interdisent la lecture automatique sans interaction : si
  // le joueur l'avait activée, elle démarre au premier clic dans la page.
  musique = signal(this.lireMusique());
  private audio = new Audio('/music.mp3');

  constructor() {
    effect(() => {
      const msg = this.gameService.snackmessage();
      if (msg.texte) {
        this.snackBar.open(msg.texte, 'ok', { duration: 2000 });
      }
    });

    this.audio.loop = true;
    this.audio.volume = 0.4;
    document.addEventListener('click', () => this.appliquerMusique(), { once: true });
  }

  private lireMusique(): boolean {
    try {
      return localStorage.getItem('music') !== 'off';
    } catch {
      return true;
    }
  }

  basculerMusique() {
    this.musique.update((m) => !m);
    try {
      localStorage.setItem('music', this.musique() ? 'on' : 'off');
    } catch {
      // préférence non mémorisée
    }
    this.appliquerMusique();
  }

  private appliquerMusique() {
    if (this.musique()) {
      // fichier absent ou lecture refusée : on reste silencieux
      this.audio.play().catch(() => undefined);
    } else {
      this.audio.pause();
    }
  }

  changerMonde(url: string) {
    void this.gameService.setServer(url);
  }

  async validerMonde() {
    if (!this.urlSaisie.trim()) return;
    if (await this.gameService.addWorld(this.urlSaisie)) {
      this.ajoutMonde.set(false);
      this.urlSaisie = '';
    }
  }

  supprimerMonde() {
    const courant = this.gameService.worlds().find((w) => w.url === this.gameService.server());
    if (courant && confirm(`Remove "${courant.name}" from the list?`)) {
      void this.gameService.removeWorld(courant.url);
    }
  }

  commitName() {
    this.gameService.commitName(this.usernameDraft);
  }

  // Refresh recharge le monde avec le pseudo saisi, même sans avoir appuyé
  // sur Entrée.
  refresh() {
    if (this.usernameDraft.trim() && this.usernameDraft !== this.gameService.user()) {
      this.gameService.commitName(this.usernameDraft.trim());
    } else {
      this.gameService.refreshWorld();
    }
  }

  cibleDe(palier: Palier): string {
    const w = this.gameService.world();
    if (palier.idcible === -1) return 'Angel effectiveness';
    if (palier.idcible === 0) return 'All products';
    return w?.products.find((p) => p.id === palier.idcible)?.name ?? '';
  }

  bonusDe(palier: Palier): string {
    switch (palier.typeratio) {
      case 'vitesse':
        return `SPEED x${palier.ratio}`;
      case 'gain':
        return `PROFITS x${palier.ratio}`;
      default:
        return `+${palier.ratio}%`;
    }
  }

  // Les anges réclamables dépendent du score : on se resynchronise d'abord
  // avec le serveur pour afficher ce que le reset accordera réellement.
  async ouvrirInvestors() {
    await this.gameService.refreshWorld(true);
    this.modal.set('investors');
  }

  async reset() {
    await this.gameService.resetWorld();
    this.modal.set(null);
  }
}

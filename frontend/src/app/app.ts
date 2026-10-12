import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatButtonModule } from '@angular/material/button';
import { MatBadgeModule } from '@angular/material/badge';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { BigValuePipe } from './bigvalue-pipe';
import { GameService } from './game.service';
import { Palier } from './graphql/schema-types';
import { Produit } from './produit/produit';

@Component({
  selector: 'app-root',
  imports: [
    MatButtonModule,
    MatBadgeModule,
    MatFormFieldModule,
    MatInputModule,
    FormsModule,
    NgTemplateOutlet,
    BigValuePipe,
    Produit,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  gameService = inject(GameService);
  private snackBar = inject(MatSnackBar);

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

  autreServeur = signal(false);
  urlSaisie = '';

  constructor() {
    effect(() => {
      const msg = this.gameService.snackmessage();
      if (msg) {
        this.snackBar.open(msg, 'ok', { duration: 2000 });
      }
    });  }

  changerMonde(valeur: string) {
    if (valeur === '__autre') {
      this.autreServeur.set(true);
      return;
    }
    this.autreServeur.set(false);
    void this.gameService.setServer(valeur);
  }

  validerServeur() {
    if (!this.urlSaisie.trim()) return;
    void this.gameService.setServer(this.urlSaisie);
    this.autreServeur.set(false);
    this.urlSaisie = '';
  }

  commitName() {
    this.gameService.commitName(this.usernameDraft);
  }

  refresh() {
    this.gameService.refreshWorld();
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

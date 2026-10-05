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

  // Anges supplémentaires gagnés par la partie en cours (formule du sujet).
  angesSupplementaires = computed(() => {
    const w = this.gameService.world();
    if (!w) return 0;
    const theorique = Math.floor(150 * Math.sqrt(w.score / 1e15));
    return Math.max(0, theorique - w.totalangels);
  });

  constructor() {
    effect(() => {
      const msg = this.gameService.snackmessage();
      if (msg) {
        this.snackBar.open(msg, 'ok', { duration: 2000 });
      }
    });
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

  async reset() {
    await this.gameService.resetWorld();
    this.modal.set(null);
  }
}

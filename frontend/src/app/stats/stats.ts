import { Component, computed, inject, OnDestroy, signal } from '@angular/core';
import { BigValuePipe } from '../bigvalue-pipe';
import { GameService } from '../game.service';

// Carte "Swag and Stats" : Finn brandit un panneau avec les statistiques de
// la partie (au-dessus du menu latéral).
@Component({
  selector: 'app-stats',
  imports: [BigValuePipe],
  templateUrl: './stats.html',
  styleUrl: './stats.css',
})
export class Stats implements OnDestroy {
  gameService = inject(GameService);

  // Gains cumulés depuis le début de la partie (le score, jamais décrémenté).
  tresor = computed(() => this.gameService.world()?.score ?? 0);

  // Nombre de produits (business) possédés.
  businesses = computed(
    () => this.gameService.world()?.products.filter((p) => p.quantite > 0).length ?? 0,
  );

  // Anges actifs gagnés grâce aux vœux de Prismo (resets).
  voeux = computed(() => this.gameService.world()?.activeangels ?? 0);

  // Temps de jeu de la session en cours.
  private debut = Date.now();
  private maintenant = signal(Date.now());
  private minuteur = setInterval(() => this.maintenant.set(Date.now()), 1000);

  tempsDeJeu = computed(() => {
    const secondes = Math.floor((this.maintenant() - this.debut) / 1000);
    const h = Math.floor(secondes / 3600);
    const m = Math.floor((secondes % 3600) / 60);
    const s = secondes % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`;
  });

  ngOnDestroy() {
    clearInterval(this.minuteur);
  }
}

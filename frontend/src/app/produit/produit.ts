import {
  Component,
  computed,
  effect,
  inject,
  input,
  OnDestroy,
  signal,
  untracked,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { BigValuePipe } from '../bigvalue-pipe';
import { SecondPipe } from '../second-pipe';
import { GameService } from '../game.service';
import { Product } from '../graphql/types';

@Component({
  selector: 'app-produit',
  imports: [MatButtonModule, BigValuePipe, SecondPipe],
  templateUrl: './produit.html',
  styleUrl: './produit.css',
})
export class Produit implements OnDestroy {
  gameService = inject(GameService);

  prod = input<Product | undefined>();
  qtmulti = input<string>('x1');

  progress = signal(0);

  // Temps restant avant la fin de la production en cours (ms).
  timeleft = computed(() => {
    const p = this.prod();
    return p && this.animating() ? p.vitesse * (1 - this.progress() / 100) : 0;
  });

  private animating = signal(false);
  private starttime = 0;
  private destroyed = false;
  // Change à chaque annulation : les anciennes boucles d'animation s'arrêtent.
  private generation = 0;

  constructor() {
    // Le monde vient d'être rechargé depuis le serveur : on abandonne la
    // production locale en cours et on reprend celle du serveur si elle existe.
    effect(() => {
      this.gameService.worldVersion();
      untracked(() => this.reinitialiser());
    });

    // Un manager vient d'être engagé : la production démarre immédiatement,
    // même si le produit n'était pas déjà en cours de fabrication.
    effect(() => {
      const p = this.prod();
      if (p?.managerUnlocked && !this.animating()) {
        untracked(() => this.demarrer(p));
      }
    });
  }

  ngOnDestroy() {
    this.destroyed = true;
  }

  startFabrication() {
    const p = this.prod();
    // Un produit qu'on ne possède pas encore ne peut pas produire.
    if (!p || p.quantite <= 0 || this.animating()) return;
    this.demarrer(p);
  }

  private reinitialiser() {
    this.generation++;
    this.animating.set(false);
    this.progress.set(0);

    const p = this.prod();
    if (p && p.timeleft > 0 && !p.managerUnlocked) {
      // reprend la production en cours côté serveur plutôt que de repartir de 0
      this.starttime = performance.now() - (p.vitesse - p.timeleft);
      this.lancerBoucle();
    }
  }

  private demarrer(p: Product) {
    this.starttime = performance.now();
    void this.gameService.startProduction(p);
    this.lancerBoucle();
  }

  private lancerBoucle() {
    this.animating.set(true);
    const gen = this.generation;
    const animate = (currentTime: number) => {
      if (this.destroyed || gen !== this.generation) return;
      const p = this.prod();
      if (!p) return;

      const elapsed = currentTime - this.starttime;
      const progressPercent = Math.min((elapsed / p.vitesse) * 100, 100);
      this.progress.set(progressPercent);

      if (progressPercent < 100) {
        requestAnimationFrame(animate);
        return;
      }

      // La barre reste affichée pleine pendant une frame avant de repartir.
      this.gameService.productionDone(p, 1);

      if (p.managerUnlocked) {
        // on avance du temps d'un cycle (et non "maintenant") pour ne pas
        // perdre de temps et rester aligné sur le calcul du serveur
        this.starttime += p.vitesse;
        requestAnimationFrame(animate);
      } else {
        requestAnimationFrame(() => {
          if (gen !== this.generation) return;
          this.progress.set(0);
          this.animating.set(false);
        });
      }
    };
    requestAnimationFrame(animate);
  }

  acheter() {
    const p = this.prod();
    if (!p) return;
    const qt = this.gameService.numberToBuy(p);
    if (qt > 0) {
      void this.gameService.buyProduct(qt, p);
    }
  }
}

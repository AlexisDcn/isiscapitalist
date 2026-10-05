import { Component, inject, input, OnDestroy, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { BigValuePipe } from '../bigvalue-pipe';
import { GameService } from '../game.service';
import { Product } from '../graphql/types';

@Component({
  selector: 'app-produit',
  imports: [MatButtonModule, BigValuePipe],
  templateUrl: './produit.html',
  styleUrl: './produit.css',
})
export class Produit implements OnInit, OnDestroy {
  gameService = inject(GameService);

  prod = input<Product | undefined>();
  qtmulti = input<string>('x1');

  progress = signal(0);

  private starttime = 0;
  private animating = false;
  private destroyed = false;

  ngOnInit() {
    const p = this.prod();
    if (p && (p.managerUnlocked || p.timeleft > 0)) {
      // reprend la production en cours (ou automatique si manager) plutôt
      // que de repartir de 0
      const dejaEcoule = p.timeleft > 0 ? p.vitesse - p.timeleft : 0;
      this.starttime = performance.now() - dejaEcoule;
      this.lancerAnimation();
    }
  }

  ngOnDestroy() {
    this.destroyed = true;
  }

  startFabrication() {
    const p = this.prod();
    if (!p || this.animating) return;
    this.starttime = performance.now();
    void this.gameService.startProduction(p);
    this.lancerAnimation();
  }

  private lancerAnimation() {
    this.animating = true;
    requestAnimationFrame(this.animate);
  }

  private animate = (currentTime: number) => {
    if (this.destroyed) return;
    const p = this.prod();
    if (!p) return;

    const elapsed = currentTime - this.starttime;
    const progressPercent = Math.min((elapsed / p.vitesse) * 100, 100);
    this.progress.set(progressPercent);

    if (progressPercent < 100) {
      requestAnimationFrame(this.animate);
      return;
    }

    this.progress.set(0);
    this.gameService.productionDone(p, 1);

    if (p.managerUnlocked) {
      this.starttime = performance.now();
      requestAnimationFrame(this.animate);
    } else {
      this.animating = false;
    }
  };

  acheter() {
    const p = this.prod();
    if (!p) return;
    const qt = this.gameService.numberToBuy(p);
    if (qt > 0) {
      void this.gameService.buyProduct(qt, p);
    }
  }
}

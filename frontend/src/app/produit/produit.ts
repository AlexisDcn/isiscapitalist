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
import { BigValuePipe } from '../bigvalue-pipe';
import { SecondPipe } from '../second-pipe';
import { GameService } from '../game.service';
import { SoundService } from '../sound.service';
import { Product } from '../graphql/schema-types';

@Component({
  selector: 'app-produit',
  imports: [BigValuePipe, SecondPipe],
  templateUrl: './produit.html',
  styleUrl: './produit.css',
})
export class Produit implements OnDestroy {
  gameService = inject(GameService);
  sons = inject(SoundService);

  // Gains qui s'envolent au-dessus de la barre à la fin d'une production.
  pops = signal<{ id: number; gain: number }[]>([]);
  private popId = 0;

  prod = input<Product | undefined>();
  qtmulti = input<string>('x1');

  progress = signal(0);

  // Temps restant avant la fin de la production en cours (ms).
  timeleft = computed(() => {
    const p = this.prod();
    return p && this.animating() ? p.vitesse * (1 - this.progress() / 100) : 0;
  });

  // Le manager engagé qui gère ce produit (affiché à côté de l'objet).
  manager = computed(() => {
    const p = this.prod();
    if (!p) return undefined;
    return this.gameService
      .world()
      ?.managers.find((m) => m.unlocked && m.idcible === p.id);
  });

  // Au-delà d'une certaine vitesse (manager + cycle très court) la barre ne
  // peut plus se remplir lisiblement : elle devient continue et on affiche le
  // gain par seconde, comme dans Adventure Capitalist.
  continu = computed(() => {
    const p = this.prod();
    return !!p && p.managerUnlocked && p.vitesse < Produit.SEUIL_CONTINU_MS;
  });

  // Gain d'une production, bonus des anges actifs compris (c'est ce qui est
  // réellement crédité) : il augmente donc visiblement après un reset.
  gainParCycle = computed(() => {
    const p = this.prod();
    const w = this.gameService.world();
    if (!p || !w) return 0;
    return p.revenu * p.quantite * (1 + (w.activeangels * w.angelbonus) / 100);
  });

  gainParSeconde = computed(() => {
    const p = this.prod();
    return p ? (this.gainParCycle() * 1000) / p.vitesse : 0;
  });

  private static readonly SEUIL_CONTINU_MS = 300;

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

      if (p.managerUnlocked) {
        // plusieurs cycles peuvent se terminer entre deux images quand la
        // production est très rapide : on les crédite tous d'un coup
        const cycles = Math.floor(elapsed / p.vitesse);
        if (cycles >= 1) {
          this.gameService.productionDone(p, cycles);
          this.starttime += cycles * p.vitesse;
          // en mode continu les gains arrivent trop vite pour être affichés un à un
          if (!this.continu()) this.afficherGain(this.gainParCycle() * cycles);
        }
        const reste = currentTime - this.starttime;
        this.progress.set(
          this.continu() ? 100 : cycles >= 1 ? 100 : Math.min((reste / p.vitesse) * 100, 100),
        );
        requestAnimationFrame(animate);
        return;
      }

      const progressPercent = Math.min((elapsed / p.vitesse) * 100, 100);
      this.progress.set(progressPercent);
      if (progressPercent < 100) {
        requestAnimationFrame(animate);
        return;
      }

      // La barre reste affichée pleine pendant une frame avant de repartir.
      this.gameService.productionDone(p, 1);
      this.afficherGain(this.gainParCycle());
      requestAnimationFrame(() => {
        if (gen !== this.generation) return;
        this.progress.set(0);
        this.animating.set(false);
      });
    };
    requestAnimationFrame(animate);
  }

  private afficherGain(gain: number) {
    const id = ++this.popId;
    this.pops.update((l) => [...l, { id, gain }]);
    setTimeout(() => this.pops.update((l) => l.filter((x) => x.id !== id)), 900);
  }

  // Clic sur un bouton d'achat désactivé (pas assez d'argent)
  refuser() {
    const p = this.prod();
    if (p && !this.gameService.canBuy(p)) this.sons.jouer('unacceptable');
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

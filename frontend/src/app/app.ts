import { Component, effect, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { BigValuePipe } from './bigvalue-pipe';
import { GameService } from './game.service';
import { Produit } from './produit/produit';

@Component({
  selector: 'app-root',
  imports: [MatButtonModule, MatFormFieldModule, MatInputModule, FormsModule, BigValuePipe, Produit],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  gameService = inject(GameService);
  private snackBar = inject(MatSnackBar);

  usernameDraft = this.gameService.user();

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
}

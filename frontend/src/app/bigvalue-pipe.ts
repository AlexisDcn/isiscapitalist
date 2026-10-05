import { Pipe, PipeTransform } from '@angular/core';

// Formate un grand nombre flottant en limitant sa précision à 4 chiffres
// significatifs, en passant en notation "10^n" au-delà du million.
@Pipe({ name: 'bigvalue' })
export class BigValuePipe implements PipeTransform {
  transform(valeur: number | null | undefined): string {
    if (valeur === null || valeur === undefined || Number.isNaN(valeur)) {
      return '0.00';
    }

    let res: string;
    if (valeur < 1000) {
      res = valeur.toFixed(2);
    } else if (valeur < 1_000_000) {
      res = valeur.toFixed(0);
    } else {
      res = valeur.toPrecision(4);
      res = res.replace(/e\+(.*)/, ' 10<sup>$1</sup>');
    }
    return res;
  }
}

import { Pipe, PipeTransform } from '@angular/core';

// Formate une durée en millisecondes sous la forme hh:mm:ss:d (d = dixièmes).
@Pipe({ name: 'second' })
export class SecondPipe implements PipeTransform {
  transform(ms: number | null | undefined): string {
    const total = Math.max(0, Math.floor(ms ?? 0));
    const dixiemes = Math.floor((total % 1000) / 100);
    const secondes = Math.floor(total / 1000) % 60;
    const minutes = Math.floor(total / 60000) % 60;
    const heures = Math.floor(total / 3600000);
    const deux = (n: number) => n.toString().padStart(2, '0');
    return `${deux(heures)}:${deux(minutes)}:${deux(secondes)}:${dixiemes}`;
  }
}

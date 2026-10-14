import { TestBed } from '@angular/core/testing';
import { Apollo } from 'apollo-angular';
import { GameService } from './game.service';
import { normalizeServerUrl, serverUrl } from './world-servers';

describe('normalizeServerUrl', () => {
  it("retire l'espace, le slash final et le suffixe /graphql", () => {
    expect(normalizeServerUrl('  https://hote.fr/ ')).toBe('https://hote.fr');
    expect(normalizeServerUrl('https://hote.fr/graphql')).toBe('https://hote.fr');
    expect(normalizeServerUrl('https://hote.fr/graphql/')).toBe('https://hote.fr');
    expect(normalizeServerUrl('http://localhost:3000')).toBe('http://localhost:3000');
  });

  it('complète le protocole manquant (http en local, https sinon)', () => {
    expect(normalizeServerUrl('localhost:3000')).toBe('http://localhost:3000');
    expect(normalizeServerUrl('127.0.0.1:3000/graphql')).toBe('http://127.0.0.1:3000');
    expect(normalizeServerUrl('capitalist.lucaslopvet.fr/graphql')).toBe(
      'https://capitalist.lucaslopvet.fr',
    );
  });
});

describe('GameService.img', () => {
  let service: GameService;
  const ancienServeur = serverUrl();

  beforeEach(() => {
    serverUrl.set('https://hote.fr');
    TestBed.configureTestingModule({
      providers: [
        {
          provide: Apollo,
          useValue: { query: () => new Promise(() => undefined) },
        },
      ],
    });
    service = TestBed.inject(GameService);
  });

  afterEach(() => serverUrl.set(ancienServeur));

  it('met un seul slash que le chemin en ait un ou non', () => {
    expect(service.img('icones/a.png')).toBe('https://hote.fr/icones/a.png');
    expect(service.img('/icones/a.png')).toBe('https://hote.fr/icones/a.png');
  });

  it('laisse intacte une URL absolue et renvoie vide si pas de chemin', () => {
    expect(service.img('https://autre.fr/b.png')).toBe('https://autre.fr/b.png');
    expect(service.img('')).toBe('');
    expect(service.img(undefined)).toBe('');
  });
});

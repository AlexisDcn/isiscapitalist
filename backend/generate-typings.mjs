// Génère src/graphql.ts à partir du schéma, avant la compilation : le fichier
// n'est pas versionné et Nest ne le crée qu'au démarrage, trop tard pour
// un build depuis un dépôt propre (Docker, CI).
import { GraphQLDefinitionsFactory } from '@nestjs/graphql';
import { join } from 'path';

await new GraphQLDefinitionsFactory().generate({
  typePaths: ['./src/**/*.graphql'],
  path: join(process.cwd(), 'src/graphql.ts'),
  outputAs: 'class',
});

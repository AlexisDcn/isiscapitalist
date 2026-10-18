import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { GraphQlResolver } from './resolver.js';

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      typePaths: ['./**/*.graphql'],
      // en production les types sont déjà générés au build (generate-typings)
      definitions:
        process.env.NODE_ENV === 'production'
          ? undefined
          : { path: join(process.cwd(), 'src/graphql.ts'), outputAs: 'class' },
    }),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'public', 'icones'),
      serveRoot: '/icones',
    }),
    // Le jeu lui-même (build Angular) : une seule adresse sert le client et
    // l'API, ce qui permet de donner un simple lien aux autres joueurs.
    ServeStaticModule.forRoot({
      rootPath: join(
        process.cwd(),
        '..',
        'frontend',
        'dist',
        'frontend',
        'browser',
      ),
      exclude: ['/graphql', '/icones/{*chemin}'],
    }),
  ],
  controllers: [AppController],
  providers: [AppService, GraphQlResolver],
})
export class AppModule {}

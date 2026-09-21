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
      definitions: {
        path: join(process.cwd(), 'src/graphql.ts'),
        outputAs: 'class',
      },
    }),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'public', 'icones'),
      serveRoot: '/icones',
    }),
  ],
  controllers: [AppController],
  providers: [AppService, GraphQlResolver],
})
export class AppModule {}

import type { CodegenConfig } from '@graphql-codegen/cli';

// Génère à partir du schéma du backend et de queries.graphql :
//  - src/app/graphql/schema-types.ts : les types du schéma (World, Product...)
//  - src/app/graphql/operations.ts   : les requêtes et mutations typées
// Utilisation : npm run codegen
const config: CodegenConfig = {
  schema: '../backend/src/schema.graphql',
  documents: 'src/app/graphql/queries.graphql',
  generates: {
    'src/app/graphql/schema-types.ts': {
      plugins: ['typescript'],
      config: { namingConvention: 'keep', enumsAsTypes: true },
    },
    'src/app/graphql/operations.ts': {
      plugins: ['typescript-operations', 'typed-document-node'],
      config: {
        namingConvention: 'keep',
        enumsAsTypes: true,
        importSchemaTypesFrom: 'src/app/graphql/schema-types',
      },
    },
  },
};

export default config;

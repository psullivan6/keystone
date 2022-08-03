import type { GraphQLSchema } from 'graphql';
import { mergeSchemas } from '@graphql-tools/schema';

import type {
  BaseFields,
  BaseModelTypeInfo,
  ExtendGraphqlSchema,
  GraphQLSchemaExtension,
  KeystoneConfig,
  KeystoneContext,
  BaseKeystoneTypeInfo,
  ModelConfig,
} from '../types';

export function config<TypeInfo extends BaseKeystoneTypeInfo>(config: KeystoneConfig<TypeInfo>) {
  return config;
}

// DO NOT RENAME
export function list<
  Fields extends BaseFields<ModelTypeInfo>,
  ModelTypeInfo extends BaseModelTypeInfo
>(config: ModelConfig<ModelTypeInfo, Fields>): ModelConfig<ModelTypeInfo, any> {
  return config;
}

export function gql(strings: TemplateStringsArray) {
  return strings[0];
}

export function graphQLSchemaExtension<Context extends KeystoneContext>({
  typeDefs,
  resolvers,
}: GraphQLSchemaExtension<Context>): ExtendGraphqlSchema {
  return (schema: GraphQLSchema) => mergeSchemas({ schemas: [schema], typeDefs, resolvers });
}

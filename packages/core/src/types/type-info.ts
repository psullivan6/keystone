import { KeystoneContext } from './context';
import { BaseItem } from './next-fields';

type GraphQLInput = Record<string, any>;

export type BaseModelTypeInfo = {
  key: string;
  fields: string;
  item: BaseItem;
  inputs: {
    create: GraphQLInput;
    update: GraphQLInput;
    where: GraphQLInput;
    uniqueWhere: { readonly id?: string | null } & GraphQLInput;
    orderBy: Record<string, 'asc' | 'desc' | null>;
  };
  all: BaseKeystoneTypeInfo;
};

export type KeystoneContextFromModelTypeInfo<ModelTypeInfo extends BaseModelTypeInfo> =
  KeystoneContext<ModelTypeInfo['all']>;

export type BaseKeystoneTypeInfo = {
  models: Record<string, BaseModelTypeInfo>;
  prisma: any;
};

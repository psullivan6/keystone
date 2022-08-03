import {
  BaseModelTypeInfo,
  JSONValue,
  FieldTypeFunc,
  CommonFieldConfig,
  jsonFieldTypePolyfilledForSQLite,
} from '../../../types';
import { graphql } from '../../..';
import { resolveView } from '../../resolve-view';

export type JsonFieldConfig<ModelTypeInfo extends BaseModelTypeInfo> =
  CommonFieldConfig<ModelTypeInfo> & {
    defaultValue?: JSONValue;
    db?: { map?: string };
  };

export const json =
  <ModelTypeInfo extends BaseModelTypeInfo>({
    defaultValue = null,
    ...config
  }: JsonFieldConfig<ModelTypeInfo> = {}): FieldTypeFunc<ModelTypeInfo> =>
  meta => {
    if ((config as any).isIndexed === 'unique') {
      throw Error("isIndexed: 'unique' is not a supported option for field type json");
    }

    const resolve = (val: JSONValue | undefined) =>
      val === null && (meta.provider === 'postgresql' || meta.provider === 'mysql')
        ? 'DbNull'
        : val;

    return jsonFieldTypePolyfilledForSQLite(
      meta.provider,
      {
        ...config,
        input: {
          create: {
            arg: graphql.arg({ type: graphql.JSON }),
            resolve(val) {
              return resolve(val === undefined ? defaultValue : val);
            },
          },
          update: { arg: graphql.arg({ type: graphql.JSON }), resolve },
        },
        output: graphql.field({ type: graphql.JSON }),
        views: resolveView('json/views'),
        getAdminMeta: () => ({ defaultValue }),
      },
      {
        default:
          defaultValue === null
            ? undefined
            : {
                kind: 'literal',
                value: JSON.stringify(defaultValue),
              },
        map: config.db?.map,
      }
    );
  };

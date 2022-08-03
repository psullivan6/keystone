import {
  BaseModelTypeInfo,
  FieldTypeFunc,
  CommonFieldConfig,
  fieldType,
  AdminMetaRootVal,
} from '../../../types';
import { graphql } from '../../..';
import { resolveView } from '../../resolve-view';

// This is the default display mode for Relationships
type SelectDisplayConfig = {
  ui?: {
    // Sets the relationship to display as a Select field
    displayMode?: 'select';
    /**
     * The path of the field to use from the related model for item labels in the select.
     * Defaults to the labelField configured on the related model.
     */
    labelField?: string;
  };
};

type CardsDisplayConfig = {
  ui?: {
    // Sets the relationship to display as a model of Cards
    displayMode: 'cards';
    /* The set of fields to render in the default Card component **/
    cardFields: readonly string[];
    /** Causes the default Card component to render as a link to navigate to the related item */
    linkToItem?: boolean;
    /** Determines whether removing a related item in the UI will delete or unlink it */
    removeMode?: 'disconnect' | 'none'; // | 'delete';
    /** Configures inline create mode for cards (alternative to opening the create modal) */
    inlineCreate?: { fields: readonly string[] };
    /** Configures inline edit mode for cards */
    inlineEdit?: { fields: readonly string[] };
    /** Configures whether a select to add existing items should be shown or not */
    inlineConnect?: boolean;
  };
};

type CountDisplayConfig = {
  many: true;
  ui?: {
    // Sets the relationship to display as a count
    displayMode: 'count';
  };
};

type OneDbConfig = {
  many?: false;
  db?: {
    foreignKey?:
      | true
      | {
          map: string;
        };
  };
};

type ManyDbConfig = {
  many: true;
  db?: {
    relationName?: string;
  };
};

export type RelationshipFieldConfig<ModelTypeInfo extends BaseModelTypeInfo> =
  CommonFieldConfig<ModelTypeInfo> & {
    many?: boolean;
    ref: string;
    ui?: {
      hideCreate?: boolean;
    };
  } & (OneDbConfig | ManyDbConfig) &
    (SelectDisplayConfig | CardsDisplayConfig | CountDisplayConfig);

export const relationship =
  <ModelTypeInfo extends BaseModelTypeInfo>({
    ref,
    ...config
  }: RelationshipFieldConfig<ModelTypeInfo>): FieldTypeFunc<ModelTypeInfo> =>
  meta => {
    const { many = false } = config;
    const [foreignmodelKey, foreignFieldKey] = ref.split('.');
    const commonConfig = {
      ...config,
      views: resolveView('relationship/views'),
      getAdminMeta: (
        adminMetaRoot: AdminMetaRootVal
      ): Parameters<typeof import('./views').controller>[0]['fieldMeta'] => {
        if (!meta.models[foreignmodelKey]) {
          throw new Error(
            `The ref [${ref}] on relationship [${meta.modelKey}.${meta.fieldKey}] is invalid`
          );
        }
        if (config.ui?.displayMode === 'cards') {
          // we're checking whether the field which will be in the admin meta at the time that getAdminMeta is called.
          // in newer versions of keystone, it will be there and it will not be there for older versions of keystone.
          // this is so that relationship fields doesn't break in confusing ways
          // if people are using a slightly older version of keystone
          const currentField = adminMetaRoot.modelByKey[meta.modelKey].fields.find(
            x => x.path === meta.fieldKey
          );
          if (currentField) {
            const allForeignFields = new Set(
              adminMetaRoot.modelByKey[foreignmodelKey].fields.map(x => x.path)
            );
            for (const [configOption, foreignFields] of [
              ['ui.cardFields', config.ui.cardFields],
              ['ui.inlineCreate.fields', config.ui.inlineCreate?.fields ?? []],
              ['ui.inlineEdit.fields', config.ui.inlineEdit?.fields ?? []],
            ] as const) {
              for (const foreignField of foreignFields) {
                if (!allForeignFields.has(foreignField)) {
                  throw new Error(
                    `The ${configOption} option on the relationship field at ${meta.modelKey}.${meta.fieldKey} includes the "${foreignField}" field but that field does not exist on the "${foreignmodelKey}" model`
                  );
                }
              }
            }
          }
        }
        return {
          refFieldKey: foreignFieldKey,
          refmodelKey: foreignmodelKey,
          many,
          hideCreate: config.ui?.hideCreate ?? false,
          ...(config.ui?.displayMode === 'cards'
            ? {
                displayMode: 'cards',
                cardFields: config.ui.cardFields,
                linkToItem: config.ui.linkToItem ?? false,
                removeMode: config.ui.removeMode ?? 'disconnect',
                inlineCreate: config.ui.inlineCreate ?? null,
                inlineEdit: config.ui.inlineEdit ?? null,
                inlineConnect: config.ui.inlineConnect ?? false,
                refLabelField: adminMetaRoot.modelByKey[foreignmodelKey].labelField,
              }
            : config.ui?.displayMode === 'count'
            ? { displayMode: 'count' }
            : {
                displayMode: 'select',
                refLabelField: adminMetaRoot.modelByKey[foreignmodelKey].labelField,
              }),
        };
      },
    };
    if (!meta.models[foreignmodelKey]) {
      throw new Error(
        `Unable to resolve related model '${foreignmodelKey}' from ${meta.modelKey}.${meta.fieldKey}`
      );
    }
    const modelTypes = meta.models[foreignmodelKey].types;
    if (config.many) {
      return fieldType({
        kind: 'relation',
        mode: 'many',
        model: foreignmodelKey,
        field: foreignFieldKey,
        relationName: config.db?.relationName,
      })({
        ...commonConfig,
        input: {
          where: {
            arg: graphql.arg({ type: modelTypes.relateTo.many.where }),
            resolve(value, context, resolve) {
              return resolve(value);
            },
          },
          create: modelTypes.relateTo.many.create && {
            arg: graphql.arg({ type: modelTypes.relateTo.many.create }),
            async resolve(value, context, resolve) {
              return resolve(value);
            },
          },
          update: modelTypes.relateTo.many.update && {
            arg: graphql.arg({ type: modelTypes.relateTo.many.update }),
            async resolve(value, context, resolve) {
              return resolve(value);
            },
          },
        },
        output: graphql.field({
          args: modelTypes.findManyArgs,
          type: graphql.list(graphql.nonNull(modelTypes.output)),
          resolve({ value }, args) {
            return value.findMany(args);
          },
        }),
        extraOutputFields: {
          [`${meta.fieldKey}Count`]: graphql.field({
            type: graphql.Int,
            args: {
              where: graphql.arg({ type: graphql.nonNull(modelTypes.where), defaultValue: {} }),
            },
            resolve({ value }, args) {
              return value.count({
                where: args.where,
              });
            },
          }),
        },
      });
    }
    return fieldType({
      kind: 'relation',
      mode: 'one',
      model: foreignmodelKey,
      field: foreignFieldKey,
      foreignKey: config.db?.foreignKey,
    })({
      ...commonConfig,
      input: {
        where: {
          arg: graphql.arg({ type: modelTypes.where }),
          resolve(value, context, resolve) {
            return resolve(value);
          },
        },
        create: modelTypes.relateTo.one.create && {
          arg: graphql.arg({ type: modelTypes.relateTo.one.create }),
          async resolve(value, context, resolve) {
            return resolve(value);
          },
        },

        update: modelTypes.relateTo.one.update && {
          arg: graphql.arg({ type: modelTypes.relateTo.one.update }),
          async resolve(value, context, resolve) {
            return resolve(value);
          },
        },
      },
      output: graphql.field({
        type: modelTypes.output,
        resolve({ value }) {
          return value();
        },
      }),
    });
  };

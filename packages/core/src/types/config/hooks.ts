import type { KeystoneContextFromModelTypeInfo } from '..';
import { BaseModelTypeInfo } from '../type-info';

type CommonArgs<ModelTypeInfo extends BaseModelTypeInfo> = {
  context: KeystoneContextFromModelTypeInfo<ModelTypeInfo>;
  /**
   * The key of the model that the operation is occurring on
   */
  modelKey: string;
};

export type ModelHooks<ModelTypeInfo extends BaseModelTypeInfo> = {
  /**
   * Used to **modify the input** for create and update operations after default values and access control have been applied
   */
  resolveInput?: ResolveInputModelHook<ModelTypeInfo>;
  /**
   * Used to **validate the input** for create and update operations once all resolveInput hooks resolved
   */
  validateInput?: ValidateInputHook<ModelTypeInfo>;
  /**
   * Used to **validate** that a delete operation can happen after access control has occurred
   */
  validateDelete?: ValidateDeleteHook<ModelTypeInfo>;
  /**
   * Used to **cause side effects** before a create, update, or delete operation once all validateInput hooks have resolved
   */
  beforeOperation?: BeforeOperationHook<ModelTypeInfo>;
  /**
   * Used to **cause side effects** after a create, update, or delete operation operation has occurred
   */
  afterOperation?: AfterOperationHook<ModelTypeInfo>;
};

// TODO: probably maybe don't do this and write it out manually
// (this is also incorrect because the return value is wrong for many of them)
type AddFieldPathToObj<T extends (arg: any) => any> = T extends (args: infer Args) => infer Result
  ? (args: Args & { fieldKey: string }) => Result
  : never;

type AddFieldPathArgToAllPropsOnObj<T extends Record<string, (arg: any) => any>> = {
  [Key in keyof T]: AddFieldPathToObj<T[Key]>;
};

export type FieldHooks<ModelTypeInfo extends BaseModelTypeInfo> = AddFieldPathArgToAllPropsOnObj<{
  /**
   * Used to **modify the input** for create and update operations after default values and access control have been applied
   */
  resolveInput?: ResolveInputFieldHook<ModelTypeInfo>;
  /**
   * Used to **validate the input** for create and update operations once all resolveInput hooks resolved
   */
  validateInput?: ValidateInputHook<ModelTypeInfo>;
  /**
   * Used to **validate** that a delete operation can happen after access control has occurred
   */
  validateDelete?: ValidateDeleteHook<ModelTypeInfo>;
  /**
   * Used to **cause side effects** before a create, update, or delete operation once all validateInput hooks have resolved
   */
  beforeOperation?: BeforeOperationHook<ModelTypeInfo>;
  /**
   * Used to **cause side effects** after a create, update, or delete operation operation has occurred
   */
  afterOperation?: AfterOperationHook<ModelTypeInfo>;
}>;

type ArgsForCreateOrUpdateOperation<ModelTypeInfo extends BaseModelTypeInfo> =
  | {
      operation: 'create';
      // technically this will never actually exist for a create
      // but making it optional rather than not here
      // makes for a better experience
      // because then people will see the right type even if they haven't refined the type of operation to 'create'
      item?: ModelTypeInfo['item'];
      /**
       * The GraphQL input **before** default values are applied
       */
      inputData: ModelTypeInfo['inputs']['create'];
      /**
       * The GraphQL input **after** default values are applied
       */
      resolvedData: ModelTypeInfo['inputs']['create'];
    }
  | {
      operation: 'update';
      item: ModelTypeInfo['item'];
      /**
       * The GraphQL input **before** default values are applied
       */
      inputData: ModelTypeInfo['inputs']['update'];
      /**
       * The GraphQL input **after** default values are applied
       */
      resolvedData: ModelTypeInfo['inputs']['update'];
    };

type ResolveInputModelHook<ModelTypeInfo extends BaseModelTypeInfo> = (
  args: ArgsForCreateOrUpdateOperation<ModelTypeInfo> & CommonArgs<ModelTypeInfo>
) =>
  | Promise<ModelTypeInfo['inputs']['create'] | ModelTypeInfo['inputs']['update']>
  | ModelTypeInfo['inputs']['create']
  | ModelTypeInfo['inputs']['update']
  // TODO: These were here to support field hooks before we created a separate type
  // (see ResolveInputFieldHook), check whether they're safe to remove now
  | Record<string, any>
  | string
  | number
  | boolean
  | null;

type ResolveInputFieldHook<ModelTypeInfo extends BaseModelTypeInfo> = (
  args: ArgsForCreateOrUpdateOperation<ModelTypeInfo> & CommonArgs<ModelTypeInfo>
) =>
  | Promise<ModelTypeInfo['inputs']['create'] | ModelTypeInfo['inputs']['update']>
  | ModelTypeInfo['inputs']['create']
  | ModelTypeInfo['inputs']['update']
  // TODO: These may or may not be correct, but without them you can't define a
  // resolveInput hook for a field that returns a simple value (e.g timestamp)
  | Record<string, any>
  | string
  | number
  | boolean
  | null
  // Fields need to be able to return `undefined` to say "don't touch this field"
  | undefined;

type ValidateInputHook<ModelTypeInfo extends BaseModelTypeInfo> = (
  args: ArgsForCreateOrUpdateOperation<ModelTypeInfo> & {
    addValidationError: (error: string) => void;
  } & CommonArgs<ModelTypeInfo>
) => Promise<void> | void;

type ValidateDeleteHook<ModelTypeInfo extends BaseModelTypeInfo> = (
  args: {
    operation: 'delete';
    item: ModelTypeInfo['item'];
    addValidationError: (error: string) => void;
  } & CommonArgs<ModelTypeInfo>
) => Promise<void> | void;

type BeforeOperationHook<ModelTypeInfo extends BaseModelTypeInfo> = (
  args: (
    | ArgsForCreateOrUpdateOperation<ModelTypeInfo>
    | {
        operation: 'delete';
        item: ModelTypeInfo['item'];
        inputData: undefined;
        resolvedData: undefined;
      }
  ) &
    CommonArgs<ModelTypeInfo>
) => Promise<void> | void;

type AfterOperationHook<ModelTypeInfo extends BaseModelTypeInfo> = (
  args: (
    | ArgsForCreateOrUpdateOperation<ModelTypeInfo>
    | {
        operation: 'delete';
        // technically this will never actually exist for a delete
        // but making it optional rather than not here
        // makes for a better experience
        // because then people will see the right type even if they haven't refined the type of operation to 'delete'
        item: undefined;
        inputData: undefined;
        resolvedData: undefined;
      }
  ) &
    ({ operation: 'delete' } | { operation: 'create' | 'update'; item: ModelTypeInfo['item'] }) &
    (
      | // technically this will never actually exist for a create
      // but making it optional rather than not here
      // makes for a better experience
      // because then people will see the right type even if they haven't refined the type of operation to 'create'
      { operation: 'create'; originalItem: undefined }
      | { operation: 'delete' | 'update'; originalItem: ModelTypeInfo['item'] }
    ) &
    CommonArgs<ModelTypeInfo>
) => Promise<void> | void;

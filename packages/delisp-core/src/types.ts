//
// Types
//

export interface TConstant {
  tag: "constant";
  name: string;
}

export interface TApplication<T = Type> {
  tag: "application";
  op: T;
  args: T[];
}

export interface TVar {
  tag: "type-variable";
  name: string;
  userSpecified: boolean;
}

export interface REmpty {
  tag: "empty-row";
}

export interface RExtension<T = Type> {
  tag: "row-extension";
  label: string;
  labelType: T;
  // TODO: Implement kind system!
  extends: T;
}

export type Row<T = Type> = REmpty | RExtension<T>;

export type TypeF<T = Type> = TConstant | TApplication<T> | TVar | Row<T>;

export interface Type {
  node: TypeF<Type>;
}

export interface TypeSchema {
  tag: "type";
  tvars: string[];
  mono: TypeF;
}

//
// Constructor helpers
//

function tConstant(name: string): TConstant {
  return { tag: "constant", name };
}

// * -> * -> *
export const tcArrow = tConstant("->");
// * -> *
export const tcVector = tConstant("vector");
// row -> *
export const tcRecord = tConstant("record");
// *
export const tVoid = tConstant("void");
export const tBoolean = tConstant("boolean");
export const tNumber = tConstant("number");
export const tString = tConstant("string");

export function tVar(name: string, userSpecified = false): TVar {
  return {
    tag: "type-variable",
    name,
    userSpecified
  };
}

export function tUserDefined(name: string): TConstant {
  return {
    tag: "constant",
    name
  };
}

export function tApp(op: TypeF, ...args: TypeF[]): TypeF {
  return {
    tag: "application",
    op: { node: op },
    args: args.map(a => ({ node: a }))
  };
}

export function tVector(t: TypeF): TypeF {
  return tApp(tcVector, t);
}

export function tFn(args: TypeF[], out: TypeF): TypeF {
  return tApp(tcArrow, ...args, out);
}

export const emptyRow: REmpty = { tag: "empty-row" };

export const tRowExtension = (
  label: string,
  labelType: TypeF,
  row: TypeF
): RExtension => ({
  tag: "row-extension",
  label,
  labelType: { node: labelType },
  extends: { node: row }
});

export function tRow(
  fields: Array<{ label: string; type: TypeF }>,
  extending: TypeF = emptyRow
): TypeF {
  return fields.reduceRight(
    (row: TypeF, { label, type }): Row => tRowExtension(label, type, row),
    extending
  );
}

export function tRecord(
  fields: Array<{ label: string; type: TypeF }>,
  extending: TypeF = emptyRow
): TypeF {
  return tApp(tcRecord, tRow(fields, extending));
}

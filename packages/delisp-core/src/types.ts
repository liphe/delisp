//
// Types
//

interface TConstantF<_T> {
  tag: "constant";
  name: string;
}

interface TApplicationF<T> {
  tag: "application";
  op: T;
  args: T[];
}

interface TVarF<_E> {
  tag: "type-variable";
  name: string;
  userSpecified: boolean;
}

interface REmptyF<_T> {
  tag: "empty-row";
}

interface RExtensionF<T> {
  tag: "row-extension";
  label: string;
  labelType: T;
  extends: T;
}

type RowF<T> = REmptyF<T> | RExtensionF<T>;
type AnyTypeF<T = Type> = TConstantF<T> | TApplicationF<T> | TVarF<T> | RowF<T>;

interface Node<A> {
  node: A;
}
export interface TConstant extends Node<TConstantF<Type>> {}
export interface TApplication extends Node<TApplicationF<Type>> {}
export interface TVar extends Node<TVarF<Type>> {}
export interface REmpty extends Node<REmptyF<Type>> {}
export interface RExtension extends Node<RExtensionF<Type>> {}
export interface Row extends Node<RowF<Type>> {}

export interface Type extends Node<AnyTypeF<Type>> {}
export type TypeF<A> = Node<AnyTypeF<A>>;

export interface TypeSchema {
  tag: "type";
  tvars: string[];
  mono: Type;
}

//
// Constructor helpers
//

function tConstant(name: string): TConstant {
  return { node: { tag: "constant", name } };
}

// * ... -> effect -> *
export const tcArrow = tConstant("->");

// * ... -> *
export const tcStar = tConstant("*");

// * -> *
export const tcVector = tConstant("vector");
// row -> *
export const tcRecord = tConstant("record");
// row -> *
export const tcCases = tConstant("cases");
// *
export const tVoid = tConstant("void");
export const tBoolean = tConstant("boolean");
export const tNumber = tConstant("number");
export const tString = tConstant("string");
export const tNone = tConstant("none");

// row -> effect
const tcEffect = tConstant("effect");

export function tVar(name: string, userSpecified = false): TVar {
  return {
    node: {
      tag: "type-variable",
      name,
      userSpecified
    }
  };
}

export function tUserDefined(name: string): TConstant {
  return { node: { tag: "constant", name } };
}

export function tApp(op: Type, ...args: Type[]): Type {
  return {
    node: {
      tag: "application",
      op,
      args
    }
  };
}

export function tVector(t: Type): Type {
  return tApp(tcVector, t);
}

export function tFn(args: Type[], effect: Type, out: Type): Type {
  return tApp(tcArrow, ...args, effect, out);
}

export const emptyRow: REmpty = { node: { tag: "empty-row" } };

export const tRowExtension = (
  label: string,
  labelType: Type,
  row: Type
): RExtension => ({
  node: {
    tag: "row-extension",
    label,
    labelType,
    extends: row
  }
});

export function tRow(
  fields: Array<{ label: string; type: Type }>,
  extending: Type = emptyRow
): Type {
  return fields.reduceRight(
    (row: Type, { label, type }): Row => tRowExtension(label, type, row),
    extending
  );
}

export function tEffect(labels: string[], extending: Type = emptyRow): Type {
  return tApp(
    tcEffect,
    tRow(labels.map(label => ({ label, type: tVoid })), extending)
  );
}

export function tRecord(
  fields: Array<{ label: string; type: Type }>,
  extending: Type = emptyRow
): Type {
  return tApp(tcRecord, tRow(fields, extending));
}

export function tCases(
  variants: Array<{ label: string; type: Type }>,
  extending: Type = emptyRow
): Type {
  return tApp(tcCases, tRow(variants, extending));
}

export function tProduct(types: Type[]) {
  return tApp(tcStar, ...types);
}

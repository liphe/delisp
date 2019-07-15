//
// Types
//
//
// This module is intended to be imported like `import * as T from "..."`
//

interface ConstantF<_T> {
  tag: "constant";
  name: string;
}

interface ApplicationF<T> {
  tag: "application";
  op: T;
  args: T[];
}

interface VarF<_T> {
  tag: "type-variable";
  name: string;
  // True if a variable has been originated as part of a
  // user-specified type annotation. Those variables have special
  // treatment during type inference.
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
type AnyTypeF<T = Type> = ConstantF<T> | ApplicationF<T> | VarF<T> | RowF<T>;

interface Node<A> {
  node: A;
}

export interface Constant extends Node<ConstantF<Type>> {}
export interface Application extends Node<ApplicationF<Type>> {}
export interface Var extends Node<VarF<Type>> {}
export interface REmpty extends Node<REmptyF<Type>> {}
export interface RExtension extends Node<RExtensionF<Type>> {}
export interface Row extends Node<RowF<Type>> {}

export interface Type extends Node<AnyTypeF<Type>> {}
export type TypeF<A> = Node<AnyTypeF<A>>;

export class TypeSchema {
  tag = "type";
  tvars: string[];
  mono: Type;
  constructor(tvars: string[], mono: Type) {
    this.tvars = tvars;
    this.mono = mono;
  }
}

//
// Constructor helpers
//

function constant(name: string): Constant {
  return { node: { tag: "constant", name } };
}

// * ... -> effect -> *
export const cArrow = constant("->");

// * ... -> *
export const cStar = constant("*");

// * -> *
export const cVector = constant("vector");
// row -> *
export const cRecord = constant("record");
// row -> *
export const cCases = constant("cases");
// *
const tVoid = constant("void");
export { tVoid as void };

export const boolean = constant("boolean");
export const number = constant("number");
export const string = constant("string");
export const none = constant("none");

// row -> effect
const cEffect = constant("effect");
// row -> values
const cValues = constant("values");

function tvar(name: string, userSpecified = false): Var {
  return {
    node: {
      tag: "type-variable",
      name,
      userSpecified
    }
  };
}
export { tvar as var };

export function userDefined(name: string): Constant {
  return { node: { tag: "constant", name } };
}

export function app(op: Type, ...args: Type[]): Type {
  return {
    node: {
      tag: "application",
      op,
      args
    }
  };
}

export function vector(t: Type): Type {
  return app(cVector, t);
}

export const emptyRow: REmpty = {
  node: { tag: "empty-row" }
};

export const rowExtension = (
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

export function row(
  fields: Array<{ label: string; type: Type }>,
  extending: Type = emptyRow
): Type {
  return fields.reduceRight(
    (row: Type, { label, type }): Row => rowExtension(label, type, row),
    extending
  );
}

export function effect(labels: string[], extending: Type = emptyRow): Type {
  return app(
    cEffect,
    row(labels.map(label => ({ label, type: tVoid })), extending)
  );
}

export function record(
  fields: Array<{ label: string; type: Type }>,
  extending: Type = emptyRow
): Type {
  return app(cRecord, row(fields, extending));
}

export function cases(
  variants: Array<{ label: string; type: Type }>,
  extending: Type = emptyRow
): Type {
  return app(cCases, row(variants, extending));
}

export function product(types: Type[]) {
  return app(cStar, ...types);
}

export function values(types: Type[], extending: Type = emptyRow): Type {
  return app(
    cValues,
    row(types.map((type, i) => ({ label: String(i), type })), extending)
  );
}

export function multiValuedFunction(
  args: Type[],
  effect: Type,
  out: Type
): Type {
  return app(cArrow, ...args, effect, out);
}

export function fn(args: Type[], effect: Type, out: Type): Type {
  return multiValuedFunction(args, effect, values([out]));
}

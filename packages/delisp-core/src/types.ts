//
// Types
//

interface TConstant {
  tag: "constant";
  name: string;
}

export interface TApplication {
  tag: "application";
  op: string;
  args: Type[];
}

export interface TVar {
  tag: "type-variable";
  name: string;
  userSpecified: boolean;
}

export interface TUserDefined {
  tag: "user-defined-type";
  name: string;
}

export interface REmpty {
  tag: "empty-row";
}

export interface RExtension {
  tag: "row-extension";
  label: string;
  labelType: Type;
  // TODO: Implement kind system!
  extends: Type;
}

export type Row = REmpty | RExtension;

export type Type = TConstant | TApplication | TVar | Row | TUserDefined;

export interface TypeSchema {
  tag: "type";
  tvars: string[];
  mono: Type;
}

//
// Constructor helpers
//

function tConstant(name: string): TConstant {
  return { tag: "constant", name };
}

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

export function tUserDefined(name: string): TUserDefined {
  return {
    tag: "user-defined-type",
    name
  };
}

export function tApp(op: string, ...args: Type[]): Type {
  return {
    tag: "application",
    op,
    args
  };
}

export function tVector(t: Type): Type {
  return tApp("vector", t);
}

export function tFn(args: Type[], out: Type): Type {
  return tApp("->", ...args, out);
}

export const emptyRow: REmpty = { tag: "empty-row" };

export const tRowExtension = (
  label: string,
  labelType: Type,
  row: Type
): RExtension => ({
  tag: "row-extension",
  label,
  labelType,
  extends: row
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

export function tRecord(
  fields: Array<{ label: string; type: Type }>,
  extending: Type = emptyRow
): Type {
  return tApp("record", tRow(fields, extending));
}

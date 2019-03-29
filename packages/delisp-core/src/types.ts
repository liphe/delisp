//
// Types
//

interface TVoid {
  tag: "void";
}

interface TBoolean {
  tag: "boolean";
}
interface TNumber {
  tag: "number";
}

interface TString {
  tag: "string";
}

export interface TApplication {
  tag: "application";
  op: string;
  args: Monotype[];
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
  labelType: Monotype;
  // TODO: Implement kind system!
  extends: Monotype;
}

export type Row = REmpty | RExtension;

export type Monotype =
  | TBoolean
  | TNumber
  | TString
  | TApplication
  | TVar
  | Row
  | TVoid
  | TUserDefined;

export interface Type {
  tag: "type";
  tvars: string[];
  mono: Monotype;
}

//
// Constructor helpers
//

export const tVoid: TVoid = {
  tag: "void"
};

export const tBoolean: TBoolean = {
  tag: "boolean"
};

export const tNumber: TNumber = {
  tag: "number"
};

export const tString: TString = {
  tag: "string"
};

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

export function tApp(op: string, ...args: Monotype[]): Monotype {
  return {
    tag: "application",
    op,
    args
  };
}

export function tVector(t: Monotype): Monotype {
  return tApp("vector", t);
}

export function tFn(args: Monotype[], out: Monotype): Monotype {
  return tApp("->", ...args, out);
}

export const emptyRow: REmpty = { tag: "empty-row" };

export const tRowExtension = (
  label: string,
  labelType: Monotype,
  row: Monotype
): RExtension => ({
  tag: "row-extension",
  label,
  labelType,
  extends: row
});

export function tRow(
  fields: Array<{ label: string; type: Monotype }>,
  extending: Monotype = emptyRow
): Monotype {
  return fields.reduceRight(
    (row: Monotype, { label, type }): Row => tRowExtension(label, type, row),
    extending
  );
}

export function tRecord(
  fields: Array<{ label: string; type: Monotype }>,
  extending: Monotype = emptyRow
): Monotype {
  return tApp("record", tRow(fields, extending));
}

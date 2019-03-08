//
// Types
//

interface TVoid {
  type: "void";
}

interface TBoolean {
  type: "boolean";
}
interface TNumber {
  type: "number";
}

interface TString {
  type: "string";
}

export interface TApplication {
  type: "application";
  op: string;
  args: Monotype[];
}

export interface TVar {
  type: "type-variable";
  name: string;
}

export interface REmpty {
  type: "empty-row";
}

export interface RExtension {
  type: "row-extension";
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
  | TVoid;

export interface Type {
  type: "type";
  tvars: string[];
  mono: Monotype;
}

//
// Constructor helpers
//

export const tVoid: TVoid = {
  type: "void"
};

export const tBoolean: TBoolean = {
  type: "boolean"
};

export const tNumber: TNumber = {
  type: "number"
};

export const tString: TString = {
  type: "string"
};

export function tVar(name: string): TVar {
  return {
    type: "type-variable",
    name
  };
}

export function tApp(op: string, ...args: Monotype[]): Monotype {
  return {
    type: "application",
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

export const emptyRow: REmpty = { type: "empty-row" };

export const tRowExtension = (
  label: string,
  labelType: Monotype,
  row: Monotype
): RExtension => ({
  type: "row-extension",
  label,
  labelType,
  extends: row
});

export function tRecord(
  fields: Array<{ label: string; type: Monotype }>,
  extending: Monotype = emptyRow
): Monotype {
  return tApp(
    "record",
    fields.reduceRight(
      (row: Monotype, { label, type }): Row => tRowExtension(label, type, row),
      extending
    )
  );
}

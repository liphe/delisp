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

interface EmptyRow {
  type: "empty-row";
}

interface RowExtension {
  type: "row-extension";
  label: string;
  labelType: Monotype;
  // TODO: Implement kind system!
  extends: Monotype;
}

type Row = EmptyRow | RowExtension;

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

const emptyRow: EmptyRow = { type: "empty-row" };

export const tRowExtension = (
  row: Monotype,
  label: string,
  labelType: Monotype
): Row => ({
  type: "row-extension",
  label,
  labelType,
  extends: row
});

export function tRecord(fields: { [key: string]: Monotype }): Monotype {
  return tApp(
    "record",
    Object.keys(fields).reduce(
      (row: Row, label: string): Row =>
        tRowExtension(row, label, fields[label]),
      emptyRow
    )
  );
}

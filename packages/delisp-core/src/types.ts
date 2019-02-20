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

interface TApplication {
  type: "application";
  op: string;
  args: Monotype[];
}

export interface TVar {
  type: "type-variable";
  name: string;
}

export interface TRecord {
  type: "record";
  fields: { [key: string]: Monotype };
}

export type Monotype =
  | TBoolean
  | TNumber
  | TString
  | TApplication
  | TVar
  | TRecord
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

export function tRecord(fields: { [key: string]: Monotype }): Monotype {
  return {
    type: "record",
    fields
  };
}

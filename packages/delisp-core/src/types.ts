//
// Types
//

export interface TVoid {
  type: "void";
}

export interface TBoolean {
  type: "boolean";
}
export interface TNumber {
  type: "number";
}

export interface TString {
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

export type Monotype =
  | TBoolean
  | TNumber
  | TString
  | TApplication
  | TVar
  | TVoid;

export interface Type {
  type: "type";
  tvars: string[];
  mono: Monotype;
}

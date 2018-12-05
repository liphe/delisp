//
// Types
//

export interface TNumber {
  type: "number";
}

export interface TString {
  type: "string";
}

export interface TApplication {
  type: "application";
  op: string;
  args: Type[];
}

export interface TVar {
  type: "type-variable";
  name: string;
}

export type Type = TNumber | TString | TApplication | TVar;

export interface LiteralBoolean {
  type: "LiteralBoolean";
  value: boolean;
}

export interface Variable {
  type: "Variable";
  name: string;
}

export type Syntax = LiteralBoolean | Variable;

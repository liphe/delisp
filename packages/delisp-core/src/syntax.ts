export interface LiteralBoolean {
  type: "LiteralBoolean";
  value: boolean;
}

export interface Variable {
  type: "Variable";
  name: string;
}

export interface LiteralNumber {
  type: "LiteralNumber";
  value: number;
}

export interface LiteralSymbol {
  type: "LiteralSymbol";
  value: string;
}

export interface List {
  type: "List";
  value: Array<Syntax>;
}

export type Syntax = LiteralBoolean | Variable | LiteralNumber | LiteralSymbol | List;

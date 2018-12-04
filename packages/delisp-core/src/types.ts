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

export function printType(type: Type): string {
  switch (type.type) {
    case "application":
      return `(${type.op} ${type.args.map(printType).join(" ")})`;
    case "number":
      return "number";
    case "string":
      return "string";
    case "type-variable":
      return type.name;
  }
}

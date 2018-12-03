//
// Types
//

export interface TNumber {
  type: "number";
}

export interface TString {
  type: "string";
}

export interface TFunction {
  type: "function";
  from: Type[];
  to: Type;
}

export interface TVar {
  type: "type-variable";
  name: string;
}

export type Type = TNumber | TString | TFunction | TVar;

export function printType(type: Type): string {
  switch (type.type) {
    case "function":
      return `(-> (${type.from.map(printType).join(" ")}) ${printType(
        type.to
      )})`;
    case "number":
      return "number";
    case "string":
      return "string";
    case "type-variable":
      return type.name;
  }
}

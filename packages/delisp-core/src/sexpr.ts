import { Location } from "./input";

export interface ASExprNumber {
  tag: "number";
  value: number;
  location: Location;
}

export interface ASExprSymbol {
  tag: "symbol";
  name: string;
  location: Location;
}

export interface ASExprString {
  tag: "string";
  value: string;
  location: Location;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface SExprArray extends Array<ASExpr> {}

export interface ASExprList {
  tag: "list";
  elements: SExprArray;
  location: Location;
}

export interface ASExprVector {
  tag: "vector";
  elements: SExprArray;
  location: Location;
}

export interface ASExprMap {
  tag: "map";
  fields: Array<{
    label: ASExprSymbol;
    value: ASExpr;
  }>;
  location: Location;
}

export type ASExpr =
  | ASExprNumber
  | ASExprSymbol
  | ASExprString
  | ASExprList
  | ASExprVector
  | ASExprMap;

export function isSymbolOfName(x: ASExpr, name: string): boolean {
  return x.tag === "symbol" && x.name === name;
}

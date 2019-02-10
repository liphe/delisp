import { Location } from "./input";

export interface ASExprNumber {
  type: "number";
  value: number;
  location: Location;
}

export interface ASExprSymbol {
  type: "symbol";
  name: string;
  location: Location;
}

export interface ASExprString {
  type: "string";
  value: string;
  location: Location;
}

export interface SExprArray extends Array<ASExpr> {}

export interface ASExprList {
  type: "list";
  shape: "round" | "square";
  elements: SExprArray;
  location: Location;
}

export type ASExpr = ASExprNumber | ASExprSymbol | ASExprString | ASExprList;

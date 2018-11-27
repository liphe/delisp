import { Location } from "./input";

export type ASExprNumber = {
  type: "number";
  value: number;
  location: Location;
};

export type ASExprSymbol = {
  type: "symbol";
  name: string;
  location: Location;
};

export type ASExprString = {
  type: "string";
  value: string;
  location: Location;
};

export interface SExprArray extends Array<ASExpr> {}

export type ASExprList = {
  type: "list";
  elements: SExprArray;
  location: Location;
};

export type ASExpr = ASExprNumber | ASExprSymbol | ASExprString | ASExprList;

import { Location } from "./input";

//
// Expressions
//

export type SVar = string;

export interface SNumber {
  type: "number";
  value: number;
  location: Location;
}

export interface SString {
  type: "string";
  value: string;
  location: Location;
}

export interface SVariableReference {
  type: "variable-reference";
  variable: SVar;
  location: Location;
}
export interface SFunctionCall {
  type: "function-call";
  fn: Expression;
  args: Expression[];
  location: Location;
}

export type LambdaList = Array<{
  variable: SVar;
  location: Location;
}>;

export interface SFunction {
  type: "function";
  lambdaList: LambdaList;
  body: Expression;
  location: Location;
}

export function functionArgs(fn: SFunction): SVar[] {
  return fn.lambdaList.map(a => a.variable);
}

export interface SLetBinding {
  var: SVar;
  value: Expression;
}

export interface SLet {
  type: "let-bindings";
  bindings: Array<SLetBinding>;
  body: Expression;
}

export type Expression =
  | SNumber
  | SString
  | SVariableReference
  | SFunctionCall
  | SFunction
  | SLet;

//
// Declarations
//

export interface SDefinition {
  type: "definition";
  variable: SVar;
  value: Expression;
  location: Location;
}

export type Declaration = SDefinition;

export type Syntax = Expression | Declaration;

export function isDeclaration(syntax: Syntax): syntax is Declaration {
  return syntax.type === "definition";
}

export interface Module {
  type: "module";
  body: Syntax[];
}

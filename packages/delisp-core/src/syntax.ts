import { Location } from "./input";

//
// Expressions
//

export type SVar = string;

interface Node<I> {
  location: Location;
  info: I;
}

export interface SNumber<I = {}> extends Node<I> {
  type: "number";
  value: number;
}

export interface SString<I = {}> extends Node<I> {
  type: "string";
  value: string;
}

export interface SVariableReference<I = {}> extends Node<I> {
  type: "variable-reference";
  variable: SVar;
}

export interface SFunctionCall<I = {}> extends Node<I> {
  type: "function-call";
  fn: Expression<I>;
  args: Expression<I>[];
}

export type LambdaList = Array<{
  variable: SVar;
  location: Location;
}>;

export interface SFunction<I = {}> extends Node<I> {
  type: "function";
  lambdaList: LambdaList;
  body: Expression<I>;
}

export function functionArgs(fn: SFunction): SVar[] {
  return fn.lambdaList.map(a => a.variable);
}

export interface SLetBinding<I = {}> {
  var: SVar;
  value: Expression<I>;
  location: Location;
}

export interface SLet<I = {}> extends Node<I> {
  type: "let-bindings";
  bindings: SLetBinding<I>[];
  body: Expression<I>;
}

export type Expression<I = {}> =
  | SNumber<I>
  | SString<I>
  | SVariableReference<I>
  | SFunctionCall<I>
  | SFunction<I>
  | SLet<I>;

//
// Declarations
//

export interface SDefinition<I = {}> {
  type: "definition";
  variable: SVar;
  value: Expression<I>;
  location: Location;
}
export type Declaration<I = {}> = SDefinition<I>;
export type Syntax<I = {}> = Expression<I> | Declaration<I>;

export function isDeclaration(syntax: Syntax): syntax is Declaration {
  return syntax.type === "definition";
}

export interface Module<I = {}> {
  type: "module";
  body: Syntax<I>[];
}

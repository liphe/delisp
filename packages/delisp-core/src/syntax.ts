import { Location } from "./input";
import { Monotype, Type } from "./types";

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
  name: SVar;
}

export interface SConditional<I = {}> extends Node<I> {
  type: "conditional";
  condition: Expression<I>;
  consequent: Expression<I>;
  alternative: Expression<I>;
}

export interface SFunctionCall<I = {}> extends Node<I> {
  type: "function-call";
  fn: Expression<I>;
  args: Array<Expression<I>>;
}

export interface LambdaList {
  positionalArgs: Array<{ variable: SVar; location: Location }>;
  location: Location;
}

export interface SFunction<I = {}> extends Node<I> {
  type: "function";
  lambdaList: LambdaList;
  body: Array<Expression<I>>;
}

export interface SVectorConstructor<I = {}> extends Node<I> {
  type: "vector";
  values: Array<Expression<I>>;
}

export interface SLetBinding<I = {}> {
  var: SVar;
  value: Expression<I>;
  location: Location;
}

export interface SLet<I = {}> extends Node<I> {
  type: "let-bindings";
  bindings: Array<SLetBinding<I>>;
  body: Array<Expression<I>>;
}

export interface SRecord<I = {}> extends Node<I> {
  type: "record";
  fields: Array<{
    label: string;
    labelLocation: Location;
    value: Expression<I>;
  }>;
  extends?: Expression<I>;
}

export interface STypeAnnotation<I = {}> extends Node<I> {
  type: "type-annotation";
  value: Expression<I>;
  valueType: Type;
}

export type Expression<I = {}> =
  | SNumber<I>
  | SString<I>
  | SVariableReference<I>
  | SConditional<I>
  | SFunctionCall<I>
  | SFunction<I>
  | SVectorConstructor<I>
  | SLet<I>
  | SRecord<I>
  | STypeAnnotation<I>;

//
// Declarations
//

export interface SDefinition<I = {}> {
  type: "definition";
  variable: SVar;
  value: Expression<I>;
  location: Location;
}

export interface SExport<I = {}> {
  type: "export";
  value: SVariableReference<I>;
  location: Location;
}

export interface STypeAlias<_I = {}> {
  type: "type-alias";
  name: SVar;
  definition: Monotype;
  location: Location;
}

export type Declaration<I = {}> = SDefinition<I> | SExport<I> | STypeAlias<I>;
export type Syntax<I = {}> = Expression<I> | Declaration<I>;

export function isDeclaration<I>(syntax: Syntax<I>): syntax is Declaration<I> {
  return (
    syntax.type === "definition" ||
    syntax.type === "export" ||
    syntax.type === "type-alias"
  );
}

export function isExpression<I>(syntax: Syntax<I>): syntax is Expression<I> {
  return !isDeclaration(syntax);
}

export function isDefinition<I>(syntax: Syntax<I>): syntax is SDefinition<I> {
  return syntax.type === "definition";
}

export function isExport<I>(syntax: Syntax<I>): syntax is SExport<I> {
  return syntax.type === "export";
}

export function isTypeAlias<I>(syntax: Syntax<I>): syntax is STypeAlias<I> {
  return syntax.type === "type-alias";
}

export interface Module<I = {}> {
  type: "module";
  body: Array<Syntax<I>>;
}

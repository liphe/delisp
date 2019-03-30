import { Location } from "./input";
import { Type } from "./types";
import { TypeWithWildcards } from "./type-wildcards";

//
// Expressions
//

interface Node<I> {
  location: Location;
  info: I;
}

export interface SNumber<I = {}> extends Node<I> {
  tag: "number";
  value: number;
}

export interface SString<I = {}> extends Node<I> {
  tag: "string";
  value: string;
}

type SVar = string;
export interface SIdentifier<I = {}> extends Node<I> {
  tag: "identifier";
  name: SVar;
}

export interface SConditional<I = {}> extends Node<I> {
  tag: "conditional";
  condition: Expression<I>;
  consequent: Expression<I>;
  alternative: Expression<I>;
}

export interface SFunctionCall<I = {}> extends Node<I> {
  tag: "function-call";
  fn: Expression<I>;
  args: Array<Expression<I>>;
}

export interface LambdaList {
  positionalArgs: SIdentifier[];
  location: Location;
}

export interface SFunction<I = {}> extends Node<I> {
  tag: "function";
  lambdaList: LambdaList;
  body: Array<Expression<I>>;
}

export interface SVectorConstructor<I = {}> extends Node<I> {
  tag: "vector";
  values: Array<Expression<I>>;
}

export interface SLetBinding<I = {}> {
  variable: SIdentifier;
  value: Expression<I>;
}

export interface SLet<I = {}> extends Node<I> {
  tag: "let-bindings";
  bindings: Array<SLetBinding<I>>;
  body: Array<Expression<I>>;
}

export interface SRecord<I = {}> extends Node<I> {
  tag: "record";
  fields: Array<{
    label: string;
    labelLocation: Location;
    value: Expression<I>;
  }>;
  extends?: Expression<I>;
}

export interface STypeAnnotation<I = {}> extends Node<I> {
  tag: "type-annotation";
  value: Expression<I>;
  typeWithWildcards: TypeWithWildcards;
}

export type Expression<I = {}> =
  | SNumber<I>
  | SString<I>
  | SIdentifier<I>
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
  tag: "definition";
  variable: SIdentifier;
  value: Expression<I>;
  location: Location;
}

export interface SExport<I = {}> {
  tag: "export";
  value: SIdentifier<I>;
  location: Location;
}

export interface STypeAlias<_I = {}> {
  tag: "type-alias";
  alias: SIdentifier;
  definition: Type;
  location: Location;
}

export type Declaration<I = {}> = SDefinition<I> | SExport<I> | STypeAlias<I>;
export type Syntax<I = {}> = Expression<I> | Declaration<I>;

export function isDeclaration<I>(syntax: Syntax<I>): syntax is Declaration<I> {
  return (
    syntax.tag === "definition" ||
    syntax.tag === "export" ||
    syntax.tag === "type-alias"
  );
}

export function isExpression<I>(syntax: Syntax<I>): syntax is Expression<I> {
  return !isDeclaration(syntax);
}

export function isDefinition<I>(syntax: Syntax<I>): syntax is SDefinition<I> {
  return syntax.tag === "definition";
}

export function isExport<I>(syntax: Syntax<I>): syntax is SExport<I> {
  return syntax.tag === "export";
}

export function isTypeAlias<I>(syntax: Syntax<I>): syntax is STypeAlias<I> {
  return syntax.tag === "type-alias";
}

export interface Module<I = {}> {
  tag: "module";
  body: Array<Syntax<I>>;
}

export interface Typed {
  type: Type;
}

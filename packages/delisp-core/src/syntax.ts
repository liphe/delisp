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

export interface SConditional<I = {}, E = Expression<I>> extends Node<I> {
  tag: "conditional";
  condition: E;
  consequent: E;
  alternative: E;
}

export interface SFunctionCall<I = {}, E = Expression<I>> extends Node<I> {
  tag: "function-call";
  fn: E;
  args: E[];
}

export interface LambdaList {
  positionalArgs: SIdentifier[];
  location: Location;
}

export interface SFunction<I = {}, E = Expression<I>> extends Node<I> {
  tag: "function";
  lambdaList: LambdaList;
  body: E[];
}

export interface SVectorConstructor<I = {}, E = Expression<I>> extends Node<I> {
  tag: "vector";
  values: E[];
}

export interface SLetBinding<I = {}, E = Expression<I>> {
  variable: SIdentifier;
  value: E;
}

export interface SLet<I = {}, E = Expression<I>> extends Node<I> {
  tag: "let-bindings";
  bindings: Array<SLetBinding<I, E>>;
  body: E[];
}

export interface SRecord<I = {}, E = Expression<I>> extends Node<I> {
  tag: "record";
  fields: Array<{
    label: SIdentifier;
    value: E;
  }>;
  extends?: E;
}

export interface STypeAnnotation<I = {}, E = Expression<I>> extends Node<I> {
  tag: "type-annotation";
  value: E;
  typeWithWildcards: TypeWithWildcards;
}

export type ExpressionF<I = {}, E = Expression<I>> =
  | SNumber<I>
  | SString<I>
  | SIdentifier<I>
  | SConditional<I, E>
  | SFunctionCall<I, E>
  | SFunction<I, E>
  | SVectorConstructor<I, E>
  | SLet<I, E>
  | SRecord<I, E>
  | STypeAnnotation<I, E>;

export interface Expression<I = {}> {
  node: ExpressionF<I, Expression<I>>;
}

//
// Declarations
//

export interface SDefinition<I = {}> {
  tag: "definition";
  variable: SIdentifier;
  value: ExpressionF<I>;
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
export type Syntax<I = {}> = ExpressionF<I> | Declaration<I>;

export function isDeclaration<I>(syntax: Syntax<I>): syntax is Declaration<I> {
  return (
    syntax.tag === "definition" ||
    syntax.tag === "export" ||
    syntax.tag === "type-alias"
  );
}

export function isExpression<I>(syntax: Syntax<I>): syntax is ExpressionF<I> {
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

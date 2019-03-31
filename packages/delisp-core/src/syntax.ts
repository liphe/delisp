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

interface SNumberF<I> extends Node<I> {
  tag: "number";
  value: number;
}

interface SStringF<I> extends Node<I> {
  tag: "string";
  value: string;
}

type SVar = string;
export interface SIdentifier<I = {}> extends Node<I> {
  tag: "identifier";
  name: SVar;
}

interface SConditionalF<I, E> extends Node<I> {
  tag: "conditional";
  condition: E;
  consequent: E;
  alternative: E;
}

interface SFunctionCallF<I, E> extends Node<I> {
  tag: "function-call";
  fn: E;
  args: E[];
}

export interface LambdaList {
  positionalArgs: SIdentifier[];
  location: Location;
}

interface SFunctionF<I, E> extends Node<I> {
  tag: "function";
  lambdaList: LambdaList;
  body: E[];
}

interface SVectorConstructorF<I, E> extends Node<I> {
  tag: "vector";
  values: E[];
}

export interface SLetBindingF<_I, E> {
  variable: SIdentifier;
  value: E;
}

interface SLetF<I, E> extends Node<I> {
  tag: "let-bindings";
  bindings: Array<SLetBindingF<I, E>>;
  body: E[];
}

interface SRecordF<I, E> extends Node<I> {
  tag: "record";
  fields: Array<{
    label: SIdentifier;
    value: E;
  }>;
  extends?: E;
}

interface STypeAnnotationF<I, E> extends Node<I> {
  tag: "type-annotation";
  value: E;
  typeWithWildcards: TypeWithWildcards;
}

export type ExpressionF<I = {}, E = Expression<I>> =
  | SNumberF<I>
  | SStringF<I>
  | SIdentifier<I>
  | SConditionalF<I, E>
  | SFunctionCallF<I, E>
  | SFunctionF<I, E>
  | SVectorConstructorF<I, E>
  | SLetF<I, E>
  | SRecordF<I, E>
  | STypeAnnotationF<I, E>;

export interface Expression<I = {}> {
  node: ExpressionF<I, Expression<I>>;
}

export interface SConditional<I = {}> {
  node: SConditionalF<I, Expression<I>>;
}

export interface SFunctionCall<I = {}> {
  node: SFunctionCallF<I, Expression<I>>;
}

export interface SFunction<I = {}> {
  node: SFunctionF<I, Expression<I>>;
}

export interface SLet<I = {}> {
  node: SLetF<I, Expression<I>>;
}

export interface SRecord<I = {}> {
  node: SRecordF<I, Expression<I>>;
}

export interface SVectorConstructor<I = {}> {
  node: SVectorConstructorF<I, Expression<I>>;
}

//
// Declarations
//

export interface SDefinition<I = {}> {
  node: {
    tag: "definition";
    variable: SIdentifier;
    value: Expression<I>;
    location: Location;
  };
}

export interface SExport<I = {}> {
  node: {
    tag: "export";
    value: SIdentifier<I>;
    location: Location;
  };
}

export interface STypeAlias<_I = {}> {
  node: {
    tag: "type-alias";
    alias: SIdentifier;
    definition: Type;
    location: Location;
  };
}

export type Declaration<I = {}> = SDefinition<I> | SExport<I> | STypeAlias<I>;
export type Syntax<I = {}> = Expression<I> | Declaration<I>;

export function isDeclaration<I>(syntax: Syntax<I>): syntax is Declaration<I> {
  return (
    syntax.node.tag === "definition" ||
    syntax.node.tag === "export" ||
    syntax.node.tag === "type-alias"
  );
}

export function isExpression<I>(syntax: Syntax<I>): syntax is Expression<I> {
  return !isDeclaration(syntax);
}

export function isDefinition<I>(syntax: Syntax<I>): syntax is SDefinition<I> {
  return syntax.node.tag === "definition";
}

export function isExport<I>(syntax: Syntax<I>): syntax is SExport<I> {
  return syntax.node.tag === "export";
}

export function isTypeAlias<I>(syntax: Syntax<I>): syntax is STypeAlias<I> {
  return syntax.node.tag === "type-alias";
}

export interface Module<I = {}> {
  tag: "module";
  body: Array<Syntax<I>>;
}

export interface Typed {
  type: Type;
}

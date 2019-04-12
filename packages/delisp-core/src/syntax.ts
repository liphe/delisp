import { Location } from "./input";
import { Type } from "./types";
import { TypeWithWildcards } from "./type-wildcards";

//
// Expressions
//

interface SNumberF {
  tag: "number";
  value: number;
}

interface SStringF {
  tag: "string";
  value: string;
}

export interface Identifier {
  tag: "identifier";
  name: SVar;
  location: Location;
}

type SVar = string;
interface SVariableReferenceF {
  tag: "variable-reference";
  name: SVar;
}

interface SConditionalF<E> {
  tag: "conditional";
  condition: E;
  consequent: E;
  alternative: E;
}

interface SFunctionCallF<E> {
  tag: "function-call";
  fn: E;
  args: E[];
}

export interface LambdaList {
  positionalArgs: Identifier[];
  location: Location;
}

interface SFunctionF<E> {
  tag: "function";
  lambdaList: LambdaList;
  body: E[];
}

interface SVectorConstructorF<E> {
  tag: "vector";
  values: E[];
}

export interface SLetBindingF<E> {
  variable: Identifier;
  value: E;
}

interface SLetF<E> {
  tag: "let-bindings";
  bindings: Array<SLetBindingF<E>>;
  body: E[];
}

interface SRecordF<E> {
  tag: "record";
  fields: Array<{
    label: Identifier;
    value: E;
  }>;
  extends?: E;
}

interface STypeAnnotationF<E> {
  tag: "type-annotation";
  value: E;
  typeWithWildcards: TypeWithWildcards;
}

interface SDoBlockF<E> {
  tag: "do-block";
  body: E[];
  returning: E;
}

interface SUnknownF<_E> {
  tag: "unknown";
}

type AnyExpressionF<I = {}, E = Expression<I>> =
  | SNumberF
  | SStringF
  | SVariableReferenceF
  | SConditionalF<E>
  | SFunctionCallF<E>
  | SFunctionF<E>
  | SVectorConstructorF<E>
  | SLetF<E>
  | SRecordF<E>
  | STypeAnnotationF<E>
  | SDoBlockF<E>
  | SUnknownF<E>;

interface Node<I, E> {
  node: E;
  location: Location;
  info: I;
}

export interface ExpressionF<I, E> extends Node<I, AnyExpressionF<I, E>> {}

export interface Expression<I = {}>
  extends Node<I, AnyExpressionF<I, Expression<I>>> {}

export interface SVariableReference<I = {}>
  extends Node<I, SVariableReferenceF> {}

export interface SConditional<I = {}>
  extends Node<I, SConditionalF<Expression<I>>> {}

export interface SFunctionCall<I = {}>
  extends Node<I, SFunctionCallF<Expression<I>>> {}

export interface SFunction<I = {}> extends Node<I, SFunctionF<Expression<I>>> {}

export interface SLet<I = {}> extends Node<I, SLetF<Expression<I>>> {}

export interface SRecord<I = {}> extends Node<I, SRecordF<Expression<I>>> {}

export interface SVectorConstructor<I = {}>
  extends Node<I, SVectorConstructorF<Expression<I>>> {}

export interface SDoBlock<I = {}> extends Node<I, SDoBlockF<Expression<I>>> {}

export interface SUnknown<I = {}> extends Node<I, SUnknownF<Expression<I>>> {}

//
// Declarations
//

export interface SDefinition<I = {}> {
  node: {
    tag: "definition";
    variable: Identifier;
    value: Expression<I>;
  };
  location: Location;
  info: I;
}

export interface SExport<I = {}> {
  node: {
    tag: "export";
    value: Identifier;
  };
  location: Location;
  info: I;
}

export interface STypeAlias<I = {}> {
  node: {
    tag: "type-alias";
    alias: Identifier;
    definition: Type;
  };
  location: Location;
  info: I;
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

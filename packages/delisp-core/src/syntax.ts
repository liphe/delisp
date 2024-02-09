//
// This module is intended to be imported like `import * as S from "..."`
//

import { Location } from "./input";
//
// Expressions
//
import {
  Identifier,
  LambdaList,
  SBooleanF,
  SConditionalF,
  SFunctionF,
  SNoneF,
  SNumberF,
  SStringF,
} from "./syntax-generated";
import { TypeWithWildcards } from "./type-wildcards";
import { Type } from "./types";

export { Identifier, LambdaList };

type SVar = string;
interface SVariableReferenceF {
  tag: "variable-reference";
  name: SVar;
  // NOTE: This should not be parted of the AST. We should split this
  // syntax into two, the user-facing Delisp language and a core
  // language.
  closedFunctionEffect?: Type;
}

interface SFunctionCallF<E> {
  tag: "function-call";
  fn: E;
  // NOTE: This should not be parted of the AST. We should split this
  // syntax into two, the user-facing Delisp language and a core
  // language.
  closedFunctionEffect?: Type;
  arguments: E[];
}

interface SVectorConstructorF<E> {
  tag: "vector";
  values: E[];
}

export interface SLetBindingF<E> {
  tag: "let-bindings-binding";
  variable: Identifier;
  value: E;
}

interface SLetF<E> {
  tag: "let-bindings";
  bindings: SLetBindingF<E>[];
  body: E[];
}

interface SRecordF<E> {
  tag: "record";
  fields: {
    label: Identifier;
    value: E;
  }[];
  source?: {
    extending: boolean;
    expression: E;
  };
}

interface SRecordGetF<E> {
  tag: "record-get";
  field: Identifier;
  value: E;
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

export interface SMatchCaseF<E> {
  label: string;
  variable: Identifier;
  body: E[];
}

interface SMatchF<E> {
  tag: "match";
  value: E;
  cases: SMatchCaseF<E>[];
  defaultCase?: E[];
}

interface SCaseTagF<E> {
  tag: "case";
  label: string;
  value?: E;
}

interface SValuesF<E> {
  tag: "values";
  values: E[];
}

interface SMultipleValueBindF<E> {
  tag: "multiple-value-bind";
  variables: Identifier[];
  form: E;
  body: E[];
}

interface SUnknownF<_E> {
  tag: "unknown";
}

type AnyExpressionF<I = {}, E = Expression<I>> =
  | SNumberF<E>
  | SStringF<E>
  | SBooleanF<E>
  | SNoneF<E>
  | SVariableReferenceF
  | SConditionalF<E>
  | SFunctionCallF<E>
  | SFunctionF<E>
  | SVectorConstructorF<E>
  | SLetF<E>
  | SRecordF<E>
  | SRecordGetF<E>
  | STypeAnnotationF<E>
  | SDoBlockF<E>
  | SMatchF<E>
  | SCaseTagF<E>
  | SValuesF<E>
  | SMultipleValueBindF<E>
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

export interface SNumber<I = {}> extends Node<I, SNumberF<Expression<I>>> {}
export interface SString<I = {}> extends Node<I, SStringF<Expression<I>>> {}
export interface SBoolean<I = {}> extends Node<I, SBooleanF<Expression<I>>> {}
export interface SNone<I = {}> extends Node<I, SNoneF<Expression<I>>> {}

export interface SConditional<I = {}>
  extends Node<I, SConditionalF<Expression<I>>> {}

export interface SFunctionCall<I = {}>
  extends Node<I, SFunctionCallF<Expression<I>>> {}

export interface SFunction<I = {}> extends Node<I, SFunctionF<Expression<I>>> {}

export interface SLet<I = {}> extends Node<I, SLetF<Expression<I>>> {}

export interface SRecord<I = {}> extends Node<I, SRecordF<Expression<I>>> {}
export interface SRecordGet<I = {}>
  extends Node<I, SRecordGetF<Expression<I>>> {}

export interface SVectorConstructor<I = {}>
  extends Node<I, SVectorConstructorF<Expression<I>>> {}

export interface SDoBlock<I = {}> extends Node<I, SDoBlockF<Expression<I>>> {}

export interface SMatch<I = {}> extends Node<I, SMatchF<Expression<I>>> {}

export interface SCaseTag<I = {}> extends Node<I, SCaseTagF<Expression<I>>> {}

export interface SValues<I = {}> extends Node<I, SValuesF<Expression<I>>> {}

export interface STypeAnnotation<I = {}>
  extends Node<I, STypeAnnotationF<Expression<I>>> {}

export interface SMultipleValueBind<I = {}>
  extends Node<I, SMultipleValueBindF<Expression<I>>> {}

export interface SUnknown<I = {}> extends Node<I, SUnknownF<Expression<I>>> {}

//
// Declarations
//

interface SDefinitionF<E> {
  tag: "definition";
  variable: Identifier;
  value: E;
}
export interface SDefinition<EInfo = {}, SInfo = {}>
  extends Node<SInfo, SDefinitionF<Expression<EInfo>>> {}

interface SImportF<_E> {
  tag: "import";
  variable: Identifier;
  source: string;
}
export interface SImport<I = {}> extends Node<I, SImportF<Expression<I>>> {}

interface SExportF<_E> {
  tag: "export";
  identifiers: Identifier[];
}
export interface SExport<I = {}> extends Node<I, SExportF<Expression<I>>> {}

interface STypeAliasF<_E> {
  tag: "type-alias";
  alias: Identifier;
  definition: Type;
}
export interface STypeAlias<I = {}>
  extends Node<I, STypeAliasF<Expression<I>>> {}

export type Declaration<EInfo = {}, SInfo = {}> =
  | SDefinition<EInfo, SInfo>
  | SExport<SInfo>
  | SImport<SInfo>
  | STypeAlias<SInfo>;

export type Syntax<EInfo = {}, SInfo = {}> =
  | Expression<EInfo>
  | Declaration<EInfo, SInfo>;

export function isDeclaration<I>(syntax: Syntax<I>): syntax is Declaration<I> {
  return (
    syntax.node.tag === "definition" ||
    syntax.node.tag === "import" ||
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

export function isImport<I>(syntax: Syntax<I>): syntax is SImport<I> {
  return syntax.node.tag === "import";
}

export function isExport<I>(syntax: Syntax<I>): syntax is SExport<I> {
  return syntax.node.tag === "export";
}

export function isTypeAlias<I>(syntax: Syntax<I>): syntax is STypeAlias<I> {
  return syntax.node.tag === "type-alias";
}

export interface Module<EInfo = {}, SInfo = {}> {
  tag: "module";
  body: Syntax<EInfo, SInfo>[];
}

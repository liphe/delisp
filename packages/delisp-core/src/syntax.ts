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
  location?: Location;
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

export interface SMatchCaseF<E> {
  label: string;
  variable: Identifier;
  body: E[];
}

interface SMatchF<E> {
  tag: "match";
  value: E;
  cases: Array<SMatchCaseF<E>>;
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
  | SMatchF<E>
  | SCaseTagF<E>
  | SValuesF<E>
  | SMultipleValueBindF<E>
  | SUnknownF<E>;

interface Node<I, E> {
  node: E;
  location?: Location;
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

export interface SMatch<I = {}> extends Node<I, SMatchF<Expression<I>>> {}

export interface SCaseTag<I = {}> extends Node<I, SCaseTagF<Expression<I>>> {}

export interface SValues<I = {}> extends Node<I, SValuesF<Expression<I>>> {}

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
  value: Identifier;
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
  body: Array<Syntax<EInfo, SInfo>>;
}

export class Typed {
  effect: Type;

  // Declared resulting type. If undefined, we'll just return the
  // expression type. This should speed up as we avoid operating on
  // double the amount of types.
  _resultingType: Type | undefined;
  expressionType: Type;

  constructor({
    expressionType,
    resultingType,
    effect
  }: {
    expressionType: Type;
    resultingType?: Type;
    effect: Type;
  }) {
    this.expressionType = expressionType;
    this._resultingType = resultingType;
    this.effect = effect;
  }

  // The `resultingType` is used as the resulting type in the parent
  // expression.
  //
  // Note that this type DOES NOT need to be equal to the type of the
  // expression itself. For instance, in the presence of multiple
  // values:
  //
  //   (+ 1 (values 1 2))
  //
  // (values 1 2) will have type `(values 1 2)`, however the type number
  // is returned to the parent expression.
  //
  // And the other way around, in:
  //
  //   (lambda (x) x)
  //
  // x as an expression has type `a`, but `(values a)` is returned to
  // the parent function.
  //
  get resultingType() {
    return this._resultingType || this.expressionType;
  }

  // Compatibility
  get type() {
    return this.resultingType;
  }
}

export function createImportSyntax(name: string, source: string): SImport {
  return {
    node: {
      tag: "import",
      variable: {
        tag: "identifier",
        name
      },
      source
    },
    info: {}
  };
}

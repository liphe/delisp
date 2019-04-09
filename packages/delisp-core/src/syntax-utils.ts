import { assertNever, InvariantViolation } from "./invariant";
import {
  isDefinition,
  isExpression,
  Identifier,
  ExpressionF,
  Expression,
  Module,
  Syntax
} from "./syntax";

export function mapExpr<I, A, B>(
  expr: ExpressionF<I, A>,
  fn: (x: A) => B
): ExpressionF<I, B> {
  switch (expr.node.tag) {
    case "string":
    case "number":
    case "variable-reference":
      return { ...expr, node: expr.node };
    case "vector":
      return {
        ...expr,
        node: {
          ...expr.node,
          values: expr.node.values.map(fn)
        }
      };
    case "record":
      return {
        ...expr,
        node: {
          ...expr.node,
          fields: expr.node.fields.map(f => ({
            ...f,
            value: fn(f.value)
          })),
          extends: expr.node.extends && fn(expr.node.extends)
        }
      };
    case "function-call":
      return {
        ...expr,
        node: {
          ...expr.node,
          fn: fn(expr.node.fn),
          args: expr.node.args.map(fn)
        }
      };
    case "conditional":
      return {
        ...expr,
        node: {
          ...expr.node,
          condition: fn(expr.node.condition),
          consequent: fn(expr.node.consequent),
          alternative: fn(expr.node.alternative)
        }
      };
    case "function":
      return {
        ...expr,
        node: {
          ...expr.node,
          body: expr.node.body.map(fn)
        }
      };
    case "let-bindings":
      return {
        ...expr,
        node: {
          ...expr.node,
          bindings: expr.node.bindings.map(b => ({
            ...b,
            value: fn(b.value)
          })),
          body: expr.node.body.map(fn)
        }
      };
    case "type-annotation":
      return {
        ...expr,
        node: {
          ...expr.node,
          value: fn(expr.node.value)
        }
      };
    case "do-block":
      return {
        ...expr,
        node: {
          ...expr.node,
          body: expr.node.body.map(fn),
          returning: fn(expr.node.returning)
        }
      };
  }
}

export function foldExpr<I, A>(
  expr: Expression<I>,
  fn: (e: ExpressionF<I, A>) => A
): A {
  return fn(mapExpr(expr, e => foldExpr(e, fn)));
}

export function transformRecurExpr<I>(
  s: Expression<I>,
  fn: (node: Expression<I>) => Expression<I>
): Expression<I> {
  return foldExpr(
    s,
    (n: ExpressionF<I, Expression<I>>): Expression<I> => fn(n)
  );
}

function expressionChildren<I>(e: Expression<I>): Array<Expression<I>> {
  switch (e.node.tag) {
    case "string":
    case "number":
    case "variable-reference":
      return [];
    case "conditional":
      return [e.node.condition, e.node.consequent, e.node.alternative];
    case "function-call":
      return [e.node.fn, ...e.node.args];
    case "function":
      return e.node.body;
    case "vector":
      return e.node.values;
    case "let-bindings":
      return [...e.node.bindings.map(b => b.value), ...e.node.body];
    case "record":
      return [...e.node.fields.map(f => f.value)];
    case "type-annotation":
      return [e.node.value];
    case "do-block":
      return [...e.node.body, e.node.returning];
  }
}

function syntaxChildren<I>(s: Syntax<I>): Array<Expression<I>> {
  if (isExpression(s)) {
    return expressionChildren({ ...s, node: s.node });
  } else {
    switch (s.node.tag) {
      case "definition":
        return [s.node.value];
      case "export":
        return [];
      case "type-alias":
        return [];
      default:
        return assertNever(s.node);
    }
  }
}

function moduleChildren<I>(m: Module<I>): Array<Syntax<I>> {
  return m.body;
}

function expressionBindings<I>(e: Expression<I>): Identifier[] {
  switch (e.node.tag) {
    case "function":
      return e.node.lambdaList.positionalArgs;
    case "let-bindings":
      return e.node.bindings.map(b => b.variable);
    default:
      return [];
  }
}

function syntaxBindings<I>(s: Syntax<I>): Identifier[] {
  if (isExpression(s)) {
    return expressionBindings(s);
  } else {
    switch (s.node.tag) {
      case "definition":
      case "export":
      case "type-alias":
        return [];
      default:
        return assertNever(s.node);
    }
  }
}

function moduleBindings<I>(m: Module<I>): Identifier[] {
  return moduleChildren(m)
    .filter(isDefinition)
    .map(d => d.node.variable);
}

type ASTNode<I> = Module<I> | Syntax<I>;
export function isModule<I>(x: ASTNode<I>): x is Module<I> {
  return "tag" in x && x.tag === "module";
}

export interface Scope<I> {
  [varName: string]: {
    node: ASTNode<I>;
    identifier: Identifier;
  };
}
type Visitor<I> = (node: ASTNode<I>, scope: Scope<I>) => void;

function createSyntaxScope<I>(
  s: Syntax<I>,
  parentScope: Scope<I> = {}
): Scope<I> {
  return syntaxBindings(s).reduce(
    (scope, binding) => ({
      ...scope,
      [binding.name]: { node: s, identifier: binding }
    }),
    parentScope
  );
}

function createModuleScope<I>(m: Module<I>): Scope<I> {
  return moduleBindings(m).reduce(
    (scope, binding) => ({
      ...scope,
      [binding.name]: { node: m, identifier: binding }
    }),
    {}
  );
}

function traverseSyntax<I>(
  s: Syntax<I>,
  parentScope: Scope<I>,
  onEnter: Visitor<I>,
  onExit: Visitor<I>
): void {
  const scope = createSyntaxScope(s, parentScope);
  onEnter(s, scope);
  syntaxChildren(s).forEach(c => {
    traverseSyntax(c, scope, onEnter, onExit);
  });
  onExit(s, scope);
}

const noop = () => {};
export function traverseModule<I>(
  m: Module<I>,
  onEnter: Visitor<I> = noop,
  onExit: Visitor<I> = noop
): void {
  const moduleScope = createModuleScope(m);
  onEnter(m, moduleScope);
  moduleChildren(m).forEach(s => {
    traverseSyntax(s, moduleScope, onEnter, onExit);
  });
  onExit(m, moduleScope);
}

function syntaxPathFromRange<I>(
  s: Syntax<I>,
  start: number,
  end: number
): Syntax<I> {
  const children = syntaxChildren(s);
  if (!(s.location.start <= start && end < s.location.end)) {
    throw new InvariantViolation(`Offset is out of range.`);
  }
  for (const c of children) {
    if (c.location.start <= start && end < c.location.end) {
      return syntaxPathFromRange(c, start, end);
    }
  }
  return s;
}

export function findSyntaxByRange<I>(
  m: Module<I>,
  start: number,
  end: number
): Syntax<I> | undefined {
  const child = m.body.find(
    e => e.location.start <= start && end < e.location.end
  );
  if (!child) {
    return;
  }
  return syntaxPathFromRange(child, start, end);
}

export function findSyntaxByOffset<I>(
  m: Module<I>,
  offset: number
): Syntax<I> | undefined {
  return findSyntaxByRange(m, offset, offset);
}

import { assertNever, InvariantViolation } from "./invariant";
import { flatten } from "./utils";
import {
  isExpression,
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
    case "unknown":
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
    case "match":
      return {
        ...expr,
        node: {
          ...expr.node,
          value: fn(expr.node.value),
          cases: expr.node.cases.map(c => ({
            label: c.label,
            variable: c.variable,
            body: c.body.map(fn)
          }))
        }
      };
  }
}

export function exprFChildren<I, E>(e: ExpressionF<I, E>): E[] {
  switch (e.node.tag) {
    case "string":
    case "number":
    case "variable-reference":
    case "unknown":
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
    case "match":
      return [e.node.value, ...flatten(e.node.cases.map(c => c.body))];
  }
}

export function foldExpr<I, A>(
  expr: Expression<I>,
  fn: (e: ExpressionF<I, A>, original: Expression<I>) => A
): A {
  return fn(mapExpr(expr, e => foldExpr(e, fn)), expr);
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

export function expressionChildren<I>(e: Expression<I>): Array<Expression<I>> {
  return exprFChildren(e);
}

export function syntaxChildren<I>(s: Syntax<I>): Array<Expression<I>> {
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

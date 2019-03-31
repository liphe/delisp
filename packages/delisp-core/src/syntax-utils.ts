import { InvariantViolation } from "./invariant";
import {
  isExpression,
  ExpressionF,
  Expression,
  Module,
  Syntax
} from "./syntax";

export function foldExpr<I, A>(
  expr: Expression<I>,
  fn: (e: ExpressionF<I, A>) => A
): A {
  switch (expr.node.tag) {
    case "string":
    case "number":
    case "variable-reference":
      return fn({ ...expr, node: expr.node });
    case "vector":
      return fn({
        ...expr,
        node: {
          ...expr.node,
          values: expr.node.values.map(s1 => foldExpr(s1, fn))
        }
      });
    case "record":
      return fn({
        ...expr,
        node: {
          ...expr.node,
          fields: expr.node.fields.map(f => ({
            ...f,
            value: foldExpr(f.value, fn)
          })),
          extends: expr.node.extends && foldExpr(expr.node.extends, fn)
        }
      });
    case "function-call":
      return fn({
        ...expr,
        node: {
          ...expr.node,
          fn: foldExpr(expr.node.fn, fn),
          args: expr.node.args.map(a => foldExpr(a, fn))
        }
      });
    case "conditional":
      return fn({
        ...expr,
        node: {
          ...expr.node,
          condition: foldExpr(expr.node.condition, fn),
          consequent: foldExpr(expr.node.consequent, fn),
          alternative: foldExpr(expr.node.alternative, fn)
        }
      });
    case "function":
      return fn({
        ...expr,
        node: {
          ...expr.node,
          body: expr.node.body.map(b => foldExpr(b, fn))
        }
      });
    case "let-bindings":
      return fn({
        ...expr,
        node: {
          ...expr.node,
          bindings: expr.node.bindings.map(b => ({
            ...b,
            value: foldExpr(b.value, fn)
          })),
          body: expr.node.body.map(e => foldExpr(e, fn))
        }
      });
    case "type-annotation":
      return fn({
        ...expr,
        node: {
          ...expr.node,
          value: foldExpr(expr.node.value, fn)
        }
      });
  }
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
        throw new InvariantViolation(`syntaxChildren() of unknown syntax`);
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

import { InvariantViolation } from "./invariant";
import { ExpressionF, Expression, Module, Syntax } from "./syntax";

export function foldExpr<I, A>(
  expr: Expression<I>,
  fn: (e: ExpressionF<I, A>) => A
): A {
  switch (expr.node.tag) {
    case "string":
    case "number":
    case "identifier":
      return fn(expr.node);
    case "vector":
      return fn({
        ...expr.node,
        values: expr.node.values.map(s1 => foldExpr(s1, fn))
      });
    case "record":
      return fn({
        ...expr.node,
        fields: expr.node.fields.map(f => ({
          ...f,
          value: foldExpr(f.value, fn)
        })),
        extends: expr.node.extends && foldExpr(expr.node.extends, fn)
      });
    case "function-call":
      return fn({
        ...expr.node,
        fn: foldExpr(expr.node.fn, fn),
        args: expr.node.args.map(a => foldExpr(a, fn))
      });
    case "conditional":
      return fn({
        ...expr.node,
        condition: foldExpr(expr.node.condition, fn),
        consequent: foldExpr(expr.node.consequent, fn),
        alternative: foldExpr(expr.node.alternative, fn)
      });
    case "function":
      return fn({
        ...expr.node,
        body: expr.node.body.map(b => foldExpr(b, fn))
      });
    case "let-bindings":
      return fn({
        ...expr.node,
        bindings: expr.node.bindings.map(b => ({
          ...b,
          value: foldExpr(b.value, fn)
        })),
        body: expr.node.body.map(e => foldExpr(e, fn))
      });
    case "type-annotation":
      return fn({
        ...expr.node,
        value: foldExpr(expr.node.value, fn)
      });
  }
}

export function transformRecurExpr<I>(
  s: ExpressionF<I>,
  fn: (node: ExpressionF<I>) => ExpressionF<I>
): ExpressionF<I> {
  return foldExpr(
    { node: s },
    (n: ExpressionF<I>): Expression<I> => ({
      node: fn(n)
    })
  ).node;
}

function expressionChildren<I>(e: ExpressionF<I>): Array<ExpressionF<I>> {
  switch (e.tag) {
    case "string":
    case "number":
    case "identifier":
      return [];
    case "conditional":
      return [e.condition.node, e.consequent.node, e.alternative.node];
    case "function-call":
      return [e.fn.node, ...e.args.map(a => a.node)];
    case "function":
      return e.body.map(e => e.node);
    case "vector":
      return e.values.map(e1 => e1.node);
    case "let-bindings":
      return [...e.bindings.map(b => b.value.node), ...e.body.map(e => e.node)];
    case "record":
      return [...e.fields.map(f => f.value.node)];
    case "type-annotation":
      return [e.value.node];
  }
}

function syntaxChildren<I>(s: Syntax<I>): Array<ExpressionF<I>> {
  switch (s.tag) {
    case "definition":
      return [s.value.node];
    case "export":
      return [s.value];
    case "type-alias":
      return [];
    default:
      return expressionChildren(s);
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

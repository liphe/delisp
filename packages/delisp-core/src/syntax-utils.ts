import { InvariantViolation } from "./invariant";
import { Expression, Module, Syntax } from "./syntax";

export function transformRecurExpr<I>(
  s: Expression<I>,
  fn: (node: Expression<I>) => Expression<I>
): Expression<I> {
  switch (s.tag) {
    case "string":
    case "number":
    case "identifier":
      return fn(s);
    case "vector":
      return fn({
        ...s,
        values: s.values.map(s1 => ({ expr: transformRecurExpr(s1.expr, fn) }))
      });
    case "record":
      return fn({
        ...s,
        fields: s.fields.map(f => ({
          ...f,
          value: { expr: transformRecurExpr(f.value.expr, fn) }
        }))
      });
    case "function-call":
      return fn({
        ...s,
        fn: { expr: transformRecurExpr(s.fn.expr, fn) },
        args: s.args.map(a => ({ expr: transformRecurExpr(a.expr, fn) }))
      });
    case "conditional":
      return fn({
        ...s,
        condition: { expr: transformRecurExpr(s.condition.expr, fn) },
        consequent: { expr: transformRecurExpr(s.consequent.expr, fn) },
        alternative: { expr: transformRecurExpr(s.alternative.expr, fn) }
      });
    case "function":
      return fn({
        ...s,
        body: s.body.map(b => ({
          expr: transformRecurExpr(b.expr, fn)
        }))
      });
    case "let-bindings":
      return fn({
        ...s,
        bindings: s.bindings.map(b => ({
          ...b,
          value: { expr: transformRecurExpr(b.value.expr, fn) }
        })),
        body: s.body.map(e => ({ expr: transformRecurExpr(e.expr, fn) }))
      });
    case "type-annotation":
      return fn({
        ...s,
        value: { expr: transformRecurExpr(s.value.expr, fn) }
      });
  }
}

function expressionChildren<I>(e: Expression<I>): Array<Expression<I>> {
  switch (e.tag) {
    case "string":
    case "number":
    case "identifier":
      return [];
    case "conditional":
      return [e.condition.expr, e.consequent.expr, e.alternative.expr];
    case "function-call":
      return [e.fn.expr, ...e.args.map(a => a.expr)];
    case "function":
      return e.body.map(e => e.expr);
    case "vector":
      return e.values.map(e1 => e1.expr);
    case "let-bindings":
      return [...e.bindings.map(b => b.value.expr), ...e.body.map(e => e.expr)];
    case "record":
      return [...e.fields.map(f => f.value.expr)];
    case "type-annotation":
      return [e.value.expr];
  }
}

function syntaxChildren<I>(s: Syntax<I>): Array<Expression<I>> {
  switch (s.tag) {
    case "definition":
      return [s.value];
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

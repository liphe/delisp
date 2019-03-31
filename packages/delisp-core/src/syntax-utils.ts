import { InvariantViolation } from "./invariant";
import { ExpressionF, Module, Syntax } from "./syntax";

export function transformRecurExpr<I>(
  s: ExpressionF<I>,
  fn: (node: ExpressionF<I>) => ExpressionF<I>
): ExpressionF<I> {
  switch (s.tag) {
    case "string":
    case "number":
    case "identifier":
      return fn(s);
    case "vector":
      return fn({
        ...s,
        values: s.values.map(s1 => ({ node: transformRecurExpr(s1.node, fn) }))
      });
    case "record":
      return fn({
        ...s,
        fields: s.fields.map(f => ({
          ...f,
          value: { node: transformRecurExpr(f.value.node, fn) }
        }))
      });
    case "function-call":
      return fn({
        ...s,
        fn: { node: transformRecurExpr(s.fn.node, fn) },
        args: s.args.map(a => ({ node: transformRecurExpr(a.node, fn) }))
      });
    case "conditional":
      return fn({
        ...s,
        condition: { node: transformRecurExpr(s.condition.node, fn) },
        consequent: { node: transformRecurExpr(s.consequent.node, fn) },
        alternative: { node: transformRecurExpr(s.alternative.node, fn) }
      });
    case "function":
      return fn({
        ...s,
        body: s.body.map(b => ({
          node: transformRecurExpr(b.node, fn)
        }))
      });
    case "let-bindings":
      return fn({
        ...s,
        bindings: s.bindings.map(b => ({
          ...b,
          value: { node: transformRecurExpr(b.value.node, fn) }
        })),
        body: s.body.map(e => ({ node: transformRecurExpr(e.node, fn) }))
      });
    case "type-annotation":
      return fn({
        ...s,
        value: { node: transformRecurExpr(s.value.node, fn) }
      });
  }
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

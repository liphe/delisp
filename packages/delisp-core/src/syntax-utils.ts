import { InvariantViolation } from "./invariant";
import { Expression, Module, STypeAnnotation, Syntax } from "./syntax";

import { Monotype } from "./types";
import { transformRecurType, generalize, instantiate } from "./type-utils";
import { generateUniqueTVar } from "./type-generate";

export function transformRecurExpr<I>(
  s: Expression<I>,
  fn: (node: Expression<I>) => Expression<I>
): Expression<I> {
  switch (s.type) {
    case "string":
    case "number":
    case "variable-reference":
      return fn(s);
    case "vector":
      return fn({
        ...s,
        values: s.values.map(s1 => transformRecurExpr(s1, fn))
      });
    case "record":
      return fn({
        ...s,
        fields: s.fields.map(f => ({
          ...f,
          value: transformRecurExpr(f.value, fn)
        }))
      });
    case "function-call":
      return fn({
        ...s,
        fn: transformRecurExpr(s.fn, fn),
        args: s.args.map(a => transformRecurExpr(a, fn))
      });
    case "conditional":
      return fn({
        ...s,
        condition: transformRecurExpr(s.condition, fn),
        consequent: transformRecurExpr(s.consequent, fn),
        alternative: transformRecurExpr(s.alternative, fn)
      });
    case "function":
      return fn({
        ...s,
        body: s.body.map(b => transformRecurExpr(b, fn))
      });
    case "let-bindings":
      return fn({
        ...s,
        bindings: s.bindings.map(b => ({
          ...b,
          value: transformRecurExpr(b.value, fn)
        })),
        body: s.body.map(e => transformRecurExpr(e, fn))
      });
    case "type-annotation":
      return fn({
        ...s,
        value: transformRecurExpr(s.value, fn)
      });
  }
}

function expressionChildren<I>(e: Expression<I>): Array<Expression<I>> {
  switch (e.type) {
    case "string":
    case "number":
    case "variable-reference":
      return [];
    case "conditional":
      return [e.condition, e.consequent, e.alternative];
    case "function-call":
      return [e.fn, ...e.args];
    case "function":
      return e.body;
    case "vector":
      return e.values;
    case "let-bindings":
      return [...e.bindings.map(b => b.value), ...e.body];
    case "record":
      return [...e.fields.map(f => f.value)];
    case "type-annotation":
      return [e.value];
  }
}

function syntaxChildren<I>(s: Syntax<I>): Array<Expression<I>> {
  switch (s.type) {
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

export function instantiateTypeAnnotation(t: STypeAnnotation): Monotype {
  const nowildcards = transformRecurType(t.valueType.typeWithWildcards, t1 => {
    if (t1.type === "type-variable" && t1.name === "_") {
      return generateUniqueTVar(false, "__t");
    } else {
      return t1;
    }
  });
  const typ = generalize(nowildcards, []);
  return instantiate(typ, true);
}

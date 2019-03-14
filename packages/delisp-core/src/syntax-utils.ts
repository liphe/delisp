import { Expression, Module, Syntax } from "./syntax";

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
    default:
      return expressionChildren(s);
  }
}

function syntaxPathFromOffset<I>(s: Syntax<I>, offset: number): Syntax<I> {
  const children = syntaxChildren(s);
  if (!(s.location.start <= offset && offset < s.location.end)) {
    throw new Error(`invariant: offset is not in syntax`);
  }
  for (const c of children) {
    if (c.location.start <= offset && offset < c.location.end) {
      return syntaxPathFromOffset(c, offset);
    }
  }
  return s;
}

export function findSyntaxByOffset<I>(
  m: Module<I>,
  offset: number
): Syntax<I> | undefined {
  const child = m.body.find(
    e => e.location.start <= offset && offset < e.location.end
  );
  if (!child) {
    return;
  }
  return syntaxPathFromOffset(child, offset);
}

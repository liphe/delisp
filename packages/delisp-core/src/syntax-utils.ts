import { assertNever, InvariantViolation } from "./invariant";
import * as S from "./syntax";
import { flatten } from "./utils";

export function mapExpr<I, A, B>(
  expr: S.ExpressionF<I, A>,
  fn: (x: A) => B
): S.ExpressionF<I, B> {
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
    case "record-get":
      return {
        ...expr,
        node: {
          ...expr.node,
          value: fn(expr.node.value)
        }
      };
    case "function-call":
      return {
        ...expr,
        node: {
          ...expr.node,
          fn: fn(expr.node.fn),
          userArguments: expr.node.userArguments.map(fn)
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
          })),
          defaultCase: expr.node.defaultCase && expr.node.defaultCase.map(fn)
        }
      };
    case "case":
      return {
        ...expr,
        node: {
          ...expr.node,
          label: expr.node.label,
          value: expr.node.value && fn(expr.node.value)
        }
      };
    case "values":
      return {
        ...expr,
        node: {
          ...expr.node,
          values: expr.node.values.map(fn)
        }
      };
    case "multiple-value-bind":
      return {
        ...expr,
        node: {
          ...expr.node,
          form: fn(expr.node.form),
          body: expr.node.body.map(fn)
        }
      };
  }
}

export function exprFChildren<I, E>(e: S.ExpressionF<I, E>): E[] {
  switch (e.node.tag) {
    case "string":
    case "number":
    case "variable-reference":
    case "unknown":
      return [];
    case "conditional":
      return [e.node.condition, e.node.consequent, e.node.alternative];
    case "function-call":
      return [e.node.fn, ...e.node.userArguments];
    case "function":
      return e.node.body;
    case "vector":
      return e.node.values;
    case "let-bindings":
      return [...e.node.bindings.map(b => b.value), ...e.node.body];
    case "record":
      return [...e.node.fields.map(f => f.value)];
    case "record-get":
      return [e.node.value];
    case "type-annotation":
      return [e.node.value];
    case "do-block":
      return [...e.node.body, e.node.returning];
    case "match":
      return [
        e.node.value,
        ...flatten(e.node.cases.map(c => c.body)),
        ...(e.node.defaultCase ? e.node.defaultCase : [])
      ];
    case "case":
      return e.node.value ? [e.node.value] : [];
    case "values":
      return e.node.values;
    case "multiple-value-bind":
      return [e.node.form, ...e.node.body];
  }
}

export function foldExpr<I, A>(
  expr: S.Expression<I>,
  fn: (e: S.ExpressionF<I, A>, original: S.Expression<I>) => A
): A {
  return fn(mapExpr(expr, e => foldExpr(e, fn)), expr);
}

export function transformRecurExpr<I>(
  s: S.Expression<I>,
  fn: (node: S.Expression<I>) => S.Expression<I>
): S.Expression<I> {
  return foldExpr(
    s,
    (n: S.ExpressionF<I, S.Expression<I>>): S.Expression<I> => fn(n)
  );
}

export function expressionChildren<I>(
  e: S.Expression<I>
): Array<S.Expression<I>> {
  return exprFChildren(e);
}

export function syntaxChildren<I>(s: S.Syntax<I>): Array<S.Expression<I>> {
  if (S.isExpression(s)) {
    return expressionChildren({ ...s, node: s.node });
  } else {
    switch (s.node.tag) {
      case "definition":
        return [s.node.value];
      case "import":
        return [];
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
  s: S.Syntax<I>,
  start: number,
  end: number
): S.Syntax<I> {
  const children = syntaxChildren(s);
  if (!(s.location && s.location.start <= start && end < s.location.end)) {
    throw new InvariantViolation(`Offset is out of range.`);
  }
  for (const c of children) {
    if (c.location && c.location.start <= start && end < c.location.end) {
      return syntaxPathFromRange(c, start, end);
    }
  }
  return s;
}

export function findSyntaxByRange<I>(
  m: S.Module<I>,
  start: number,
  end: number
): S.Syntax<I> | undefined {
  const child = m.body.find(e =>
    e.location ? e.location.start <= start && end < e.location.end : false
  );
  if (!child) {
    return;
  }
  return syntaxPathFromRange(child, start, end);
}

export function findSyntaxByOffset<I>(
  m: S.Module<I>,
  offset: number
): S.Syntax<I> | undefined {
  return findSyntaxByRange(m, offset, offset);
}

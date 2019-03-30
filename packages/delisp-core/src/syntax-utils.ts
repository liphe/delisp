import { InvariantViolation } from "./invariant";
import { Expression, isDefinition, Module, Syntax } from "./syntax";

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
  switch (e.tag) {
    case "string":
    case "number":
    case "identifier":
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

function expressionBindings<I>(e: Expression<I>): string[] {
  switch (e.tag) {
    case "function":
      return e.lambdaList.positionalArgs.map(l => l.name);
    case "let-bindings":
      return e.bindings.map(b => b.variable.name);
    default:
      return [];
  }
}

function syntaxBindings<I>(s: Syntax<I>): string[] {
  switch (s.tag) {
    case "definition":
      return [s.variable.name];
    case "export":
    case "type-alias":
      return [];
    default:
      return expressionBindings(s);
  }
}

function moduleBindings<I>(m: Module<I>): string[] {
  return m.body.filter(isDefinition).map(d => d.variable.name);
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

type Scope = Map<string, symbol>;
function createScope(bindings: string[], parentScope?: Scope): Scope {
  const scope = parentScope ? new Map(parentScope) : new Map();
  bindings.forEach(b => scope.set(b, Symbol(b)));
  return scope;
}

type VisitorFn<I> = (s: Syntax<I>, scope: Scope) => void;
function traverse<I>(
  s: Syntax<I>,
  scope: Scope,
  onEnter?: VisitorFn<I>,
  onExit?: VisitorFn<I>
): void {
  if (onEnter) {
    onEnter(s, scope);
  }
  const newScope = createScope(syntaxBindings(s), scope);
  syntaxChildren(s).forEach(c => {
    traverse(c, newScope, onEnter, onExit);
  });
  if (onExit) {
    onExit(s, scope);
  }
}

export function traverseModule<I>(
  m: Module<I>,
  onEnter?: VisitorFn<I>,
  onExit?: VisitorFn<I>
): void {
  const globalScope = createScope(moduleBindings(m));
  m.body.forEach(s => {
    traverse(s, globalScope, onEnter, onExit);
  });
}

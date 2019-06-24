import primitives from "./primitives";

export { primitives };

export default Object.entries(primitives).reduce(
  (runtime, [name, def]) => ({ ...runtime, [name]: def.value }),
  {}
);

//
// Cases
//

export class TaggedValue {
  tag: string;
  value: unknown;
  constructor(tag: string, value: unknown) {
    this.tag = tag;
    this.value = value;
  }
}

export function matchTag(
  obj: TaggedValue,
  cases: { [label: string]: (value: unknown) => unknown },
  defaultCase?: () => unknown
): unknown {
  const handler = cases[obj.tag] || defaultCase;
  return handler(obj.value);
}

export function caseTag(tag: string, value: unknown): TaggedValue {
  return new TaggedValue(tag, value);
}

//
// Tuples
//

export class Pair<A, B> {
  fst: A;
  snd: B;
  constructor(fst: A, snd: B) {
    this.fst = fst;
    this.snd = snd;
  }
}

export function pair<A, B>(a: A, b: B): Pair<A, B> {
  return new Pair(a, b);
}

export function fst<A, B>(pair: Pair<A, B>): A {
  return pair.fst;
}

export function snd<A, B>(pair: Pair<A, B>): B {
  return pair.snd;
}

//
// Multiple values
//

export class MultipleValues {
  values: unknown[];
  constructor(values: unknown[]) {
    this.values = values;
  }
}

export function values(...x: unknown[]): MultipleValues {
  return new MultipleValues(x);
}

export function primaryValue(x: MultipleValues): unknown {
  return x instanceof MultipleValues ? x.values[0] : x;
}

export function mvbind(x: unknown, fn: (...xs: unknown[]) => unknown): unknown {
  if (x instanceof MultipleValues) {
    return fn.apply(null, x.values);
  } else {
    return fn(x);
  }
}

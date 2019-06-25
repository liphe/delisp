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

export function primaryValue(x: unknown, ..._others: unknown[]): unknown {
  return x;
}

// bit of a hack for toplevel function calls
export const values = primaryValue;

export function bindPrimaryValue(fn: Function): Function {
  return (...args: unknown[]) => fn(primaryValue, ...args);
}

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

export function matchTag<T>(
  obj: TaggedValue,
  cases: { [label: string]: (value: unknown) => T },
  defaultCase?: () => T
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

export function primPair<A, B>(a: A, b: B): Pair<A, B> {
  return new Pair(a, b);
}

export function primFst<A, B>(pair: Pair<A, B>): A {
  return pair.fst;
}

export function primSnd<A, B>(pair: Pair<A, B>): B {
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

export function bindPrimaryValue(fn: Function, ctx: unknown): Function {
  return (...args: unknown[]) => fn(primaryValue, ctx, ...args);
}

export function mvbind(
  form: (values: any, ...args: any[]) => any,
  cont: (...results: any[]) => any
) {
  let valuesCalled = false;

  const values = (...results: any[]) => {
    valuesCalled = true;
    return cont(...results);
  };

  const result = form(values);

  if (valuesCalled) {
    return result;
  } else {
    return values(result);
  }
}

export function assert(x: boolean, message: string) {
  if (!x) {
    throw new Error(message);
  }
}

//
// Async primitives
//

export function promiseMap<A, B>(
  array: A[],
  f: (x: A) => Promise<B>
): Promise<B[]> {
  return Promise.all(array.map(f));
}

export async function promiseReduce<A, B>(
  array: A[],
  reducer: (x: B, y: A) => Promise<B>,
  initial: B
): Promise<B> {
  let value: B = initial;
  for (const elem of array) {
    value = await reducer(value, elem);
  }
  return value;
}

export async function promiseFilter<A>(
  array: A[],
  predicate: (x: A) => Promise<boolean>
): Promise<A[]> {
  const flags = await Promise.all(array.map(predicate));
  return array.filter((_, i) => flags[i]);
}

export function promiseDelay(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

export function flatMap<A, B>(fn: (x: A, i: number) => B[], list: A[]): B[] {
  return flatten(list.map((x, i) => fn(x, i)));
}

export function maybeMap<A, B>(
  fn: (x: A, i: number) => B | null,
  list: A[]
): B[] {
  return list.map((x, i) => fn(x, i)).filter((x): x is B => x !== null);
}

export function flatten<A>(x: A[][]): A[] {
  return ([] as A[]).concat(...x);
}

export function union<A>(xs: A[], ...more: A[][]): A[] {
  return unique([...xs, ...flatten(more)]);
}

export function intersection<A>(xs: A[], ys: A[]): A[] {
  return xs.filter((x) => ys.includes(x));
}

export function difference<A>(xs: A[], ys: A[]): A[] {
  return xs.filter((x) => !ys.includes(x));
}

export function unique<A>(array: A[]): A[] {
  const seen: Set<A> = new Set();
  const result = [];
  for (const x of array) {
    if (!seen.has(x)) {
      result.push(x);
      seen.add(x);
    }
  }
  return result;
}

/** Return duplicated elements of array that are not the first occurance. */
export function duplicatedItemsBy<A, K>(array: A[], fn: (x: A) => K): A[] {
  const seen: Set<K> = new Set();
  const duplicated = [];
  for (const x of array) {
    const key = fn(x);
    if (seen.has(key)) {
      duplicated.push(x);
    }
    seen.add(key);
  }
  return duplicated;
}

/** Return the last element of a list, or undefined if it is empty */
export function last<A>(x: A[]): A | undefined {
  return x[x.length - 1];
}

/** Map over the values of an object
 *
 * @description
 * Call `fn` for each entry of `obj` with the _value_ as the first
 * argument and the _key_ as the second one.
 *
 * @return an object with the same keys, where the values are the
 * returned values of `fn` for the corresponding keys.
 *
 */
export function mapObject<A, B>(
  obj: { [key: string]: A },
  fn: (value: A, key: string) => B
): { [key: string]: B } {
  const out: { [key: string]: B } = {};
  for (const k of Object.keys(obj)) {
    out[k] = fn(obj[k], k);
  }
  return out;
}

/** Return an array with elements from 0 up to n (not included). */
export function range(n: number) {
  return new Array(Math.max(0, n)).fill(0).map((_, i) => i);
}

export function equals(arr1: unknown[], arr2: unknown[]): boolean {
  if (arr1.length !== arr2.length) {
    return false;
  } else {
    for (let i = 0; i < arr1.length; i++) {
      if (arr1[i] !== arr2[i]) {
        return false;
      }
    }
    return true;
  }
}

/** Capitalize a string like "foo" to "Foo". */
export function capitalize(str: string) {
  if (str === "") {
    return "";
  } else {
    return str[0].toUpperCase() + str.slice(1);
  }
}

/** Build an object from an array of pairs */
export function fromEntries<T>(entries: [string, T][]): { [key: string]: T } {
  return entries.reduce((obj, [key, value]) => {
    return { ...obj, [key]: value };
  }, {});
}

export function zip<A, B>(xs: A[], ys: B[]): [A, B][] {
  const shortest: (A | B)[] = xs.length < ys.length ? xs : ys;
  return shortest.map((_: A | B, i: number) => [xs[i], ys[i]]);
}

export function isDefined<A>(x: A | undefined): x is A {
  return x !== undefined;
}

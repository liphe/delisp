export function flatMap<A, B>(fn: (x: A) => B[], list: A[]): B[] {
  return flatten(list.map(x => fn(x)));
}

export function maybeMap<A, B>(fn: (x: A) => B | null, list: A[]): B[] {
  return list.map(x => fn(x)).filter((x): x is B => x !== null);
}

export function flatten<A>(x: A[][]): A[] {
  return ([] as A[]).concat(...x);
}

export function union<A>(xs: A[], ys: A[]): A[] {
  return unique([...xs, ...ys]);
}

export function intersection<A>(xs: A[], ys: A[]): A[] {
  return xs.filter(x => ys.includes(x));
}

export function difference<A>(xs: A[], ys: A[]): A[] {
  return xs.filter(x => !ys.includes(x));
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

export function equals(arr1: Array<unknown>, arr2: Array<unknown>): boolean {
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

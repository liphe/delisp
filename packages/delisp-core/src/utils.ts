export function flatten<A>(x: A[][]): A[] {
  return ([] as A[]).concat(...x);
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

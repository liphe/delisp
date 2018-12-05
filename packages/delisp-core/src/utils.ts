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

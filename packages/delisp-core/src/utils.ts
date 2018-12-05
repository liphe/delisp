export function flatten<A>(x: Array<Array<A>>): Array<A> {
  return ([] as A[]).concat(...x);
}

export function unique<A>(array: Array<A>): Array<A> {
  const seen: Set<A> = new Set();
  let result = [];
  for (let x of array) {
    if (!seen.has(x)) {
      result.push(x);
      seen.add(x);
    }
  }
  return result;
}

/** The current location in the source tree.
 *
 * - `value` - is the current node of the AST
 * - `update` - a function to replace the current node in the AST with a new one.
 *
 * Additionally, the methods `prop` and `index` allow you to to dig
 * into the tree structure from a given cursor.
 *
 * Note: cursors are lenses bound to the toplevel value automatically.
 *
 */
export class Cursor<T> {
  value: T;
  update: (newValue: T) => void;

  constructor(value: T, update: (newValue: T) => void) {
    this.value = value;
    this.update = update;
  }

  prop<A extends keyof T>(key: A): Cursor<T[A]> {
    return new Cursor(this.value[key], (newValue: T[A]) => {
      this.update({ ...this.value, [key]: newValue });
    });
  }

  static index<T>(cursor: Cursor<T[]>, ix: number): Cursor<T> {
    return new Cursor(cursor.value[ix], (newElem: T) =>
      cursor.update([
        ...cursor.value.slice(0, ix),
        newElem,
        ...cursor.value.slice(ix + 1),
      ])
    );
  }

  static map<T, K>(
    cursor: Cursor<T[]>,
    fn: (c: Cursor<T>, i: number) => K
  ): K[] {
    return cursor.value.map((_elem, ix) => fn(Cursor.index(cursor, ix), ix));
  }

  static slice<T>(
    cursor: Cursor<T[]>,
    begin: number,
    end?: number
  ): Cursor<T[]> {
    return new Cursor(cursor.value.slice(begin, end), (newElems: T[]) =>
      cursor.update([
        ...cursor.value.slice(0, begin),
        ...newElems,
        ...(end !== undefined ? cursor.value.slice(end) : []),
      ])
    );
  }
}

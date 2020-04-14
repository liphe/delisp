import * as Delisp from "@delisp/core";
import * as React from "react";
import { useContext } from "react";

export const Context = React.createContext<
  ReturnType<typeof Delisp.createVariableNormalizer>
>(null as any);

export function useTypeNormalizer() {
  return useContext(Context);
}

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
}

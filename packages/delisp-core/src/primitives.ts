import { readType } from "./type-utils";
import { Type } from "./types";
import { mapObject } from "./utils";

interface Primitive {
  type: Type;
  value: unknown;
}

function primitives(prims: {
  [name: string]: { type: string; value: unknown };
}) {
  return mapObject(
    prims,
    (spec): Primitive => ({
      type: readType(spec.type),
      value: spec.value
    })
  );
}

export default primitives({
  // log: {
  //   type: "(-> string string)",
  //   fn: (...args: any) => {
  //     /* tslint:disable:no-console */
  //     console.log(...args);
  //     /* tslint:enable:no-console */
  //     return
  //   }
  // },

  true: {
    type: "boolean",
    value: true
  },

  false: {
    type: "boolean",
    value: false
  },

  not: {
    type: "(-> boolean boolean)",
    value: (a: boolean) => !a
  },

  and: {
    type: "(-> boolean boolean boolean)",
    value: (a: boolean, b: boolean) => a && b
  },

  or: {
    type: "(-> boolean boolean boolean)",
    value: (a: boolean, b: boolean) => a || b
  },

  "<": {
    type: "(-> number number boolean)",
    value: (a: number, b: number) => a < b
  },

  "+": {
    type: "(-> number number number)",
    value: (a: number, b: number) => a + b
  },

  "*": {
    type: "(-> number number number)",
    value: (a: number, b: number) => a * b
  }
});

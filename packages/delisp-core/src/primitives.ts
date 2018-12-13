import { readType } from "./type-utils";
import { Type } from "./types";
import { mapObject } from "./utils";

type FN = (...args: any[]) => any;

interface Primitive {
  type: Type;
  fn: FN;
}

function primitives(prims: { [name: string]: { type: string; fn: FN } }) {
  return mapObject(prims, (spec, name) => ({
    type: readType(spec.type),
    fn: spec.fn
  }));
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

  "+": {
    type: "(-> number number number)",
    fn: (a: number, b: number) => a + b
  },

  "*": {
    type: "(-> number number number)",
    fn: (a: number, b: number) => a * b
  }
});

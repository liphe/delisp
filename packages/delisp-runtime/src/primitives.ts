import { Primitives } from "./types";

import booleanPrims from "./boolean";
import vectorPrims from "./vector";
import stringPrims from "./string";

const prims: Primitives = {
  "<": {
    type: "(-> number number _ boolean)",
    value: (a: number, b: number) => a < b
  },

  unknown: {
    type: "(-> string string number number _ a)",
    value: (
      message: string,
      file: string,
      line: number,
      column: number
    ): never => {
      throw new Error(`ERROR:${file}:${line}$:${column}: ${message}.`);
    }
  },

  ...booleanPrims,
  ...vectorPrims,
  ...stringPrims
};

export default prims;

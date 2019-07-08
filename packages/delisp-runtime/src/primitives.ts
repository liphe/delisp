import stringPrims from "./string";
import { Primitives } from "./types";
import vectorPrims from "./vector";

const prims: Primitives = {
  "<": {
    type: "(-> number number _ boolean)",
    value: (_values: unknown, a: number, b: number) => a < b
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

  ...vectorPrims,
  ...stringPrims
};

export default prims;

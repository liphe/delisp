import stringPrims from "./string";
import { Primitives } from "./types";
import vectorPrims from "./vector";

const prims: Primitives = {
  unknown: {
    type: "(-> _ctx string string number number (effect) a)",
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

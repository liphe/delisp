import { Primitives } from "./types";

import booleanPrims from "./boolean";
import vectorPrims from "./vector";
import stringPrims from "./string";

const prims: Primitives = {
  "<": {
    type: "(-> number number boolean)",
    value: (a: number, b: number) => a < b
  },

  ...booleanPrims,
  ...vectorPrims,
  ...stringPrims
};

export default prims;

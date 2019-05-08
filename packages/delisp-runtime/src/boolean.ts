import { Primitives } from "./types";

const booleanPrims: Primitives = {
  not: {
    type: "(-> boolean _ boolean)",
    value: (a: boolean) => !a
  },

  and: {
    type: "(-> boolean boolean _ boolean)",
    value: (a: boolean, b: boolean) => a && b
  },

  or: {
    type: "(-> boolean boolean _ boolean)",
    value: (a: boolean, b: boolean) => a || b
  }
};

export default booleanPrims;

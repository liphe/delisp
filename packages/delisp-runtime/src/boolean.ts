import { Primitives } from "./types";

const booleanPrims: Primitives = {
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
  }
};

export default booleanPrims;

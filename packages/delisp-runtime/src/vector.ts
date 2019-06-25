import { Primitives } from "./types";

const vectorPrims: Primitives = {
  nil: {
    type: "[a]",
    value: []
  },

  cons: {
    type: "(-> a [a] _ [a])",
    value: <T>(_values: unknown, a: T, list: T[]): T[] => [a, ...list]
  },

  first: {
    type: "(-> [a] (effect exp | _) a)",
    value: <T>(_values: unknown, list: T[]): T => {
      if (list.length > 0) {
        return list[0];
      } else {
        throw Error("Cannot get first element of empty list");
      }
    }
  },

  rest: {
    type: "(-> [a] (effect exp | _) [a])",
    value: <T>(_values: unknown, list: T[]): T[] => {
      if (list.length > 0) {
        const [, ...rest] = list;
        return rest;
      } else {
        throw Error("Cannot get first element of empty list");
      }
    }
  },

  "empty?": {
    type: "(-> [a] _ boolean)",
    value: <T>(_values: unknown, list: T[]): boolean => list.length === 0
  }
};

export default vectorPrims;

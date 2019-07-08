import { Primitives } from "./types";

const vectorPrims: Primitives = {
  first: {
    type: "(-> [a] (effect exp | _) (values a (-> a _ [a])))",
    value: <T>(values: any, list: T[]): T => {
      if (list.length > 0) {
        return values(list[0], (_values: unknown, newValue: T) => {
          return [newValue, ...list.slice(1)];
        });
      } else {
        throw Error("Cannot get first element of empty list");
      }
    }
  },

  rest: {
    type: "(-> [a] (effect exp | _) (values [a] (-> [a] _ [a])))",
    value: <T>(values: any, list: T[]): T[] => {
      if (list.length > 0) {
        const [head, ...rest] = list;
        return values(rest, (_values: unknown, newRest: T[]) => {
          return [head, ...newRest];
        });
      } else {
        throw Error("Cannot get first element of empty list");
      }
    }
  }
};

export default vectorPrims;

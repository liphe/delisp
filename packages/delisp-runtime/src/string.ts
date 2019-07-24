import { Primitives } from "./types";

function validBoundingIndex(str: string, start: number, end: number) {
  if (!(0 <= start && start <= end && end <= str.length)) {
    throw new Error(
      `Invalid bounding indexes (${start}, ${end}) for the string ${str}.`
    );
  }
}

const stringPrims: Primitives = {
  substring: {
    type:
      "(-> _ctx1 number number _ (-> _ctx2 string _ (values string (-> _ctx3 string _ string))))",
    value: (_values: unknown, start: number, end: number) => {
      return (values: any, str: string) => {
        validBoundingIndex(str, start, end);
        const value = str.slice(start, end);
        const update = (_value: unknown, newString: string) => {
          return str.slice(0, start) + newString + str.slice(end + 1);
        };
        return values(value, update);
      };
    }
  }
};

export default stringPrims;

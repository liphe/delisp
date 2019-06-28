import { Primitives } from "./types";

function validBoundingIndex(str: string, start: number, end: number) {
  if (!(0 <= start && start <= end && end <= str.length)) {
    throw new Error(
      `Invalid boudning indexes (${start}, ${end}) for the string ${str}.`
    );
  }
}

const stringPrims: Primitives = {
  substring: {
    type:
      "(-> number number _ (-> string _ (values string (-> string _ string))))",
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

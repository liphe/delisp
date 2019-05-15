import { Primitives } from "./types";

function validBoundingIndex(str: string, start: number, end: number) {
  if (!(0 <= start && start <= end && end <= str.length)) {
    throw new Error(
      `Invalid boudning indexes (${start}, ${end}) for the string ${str}.`
    );
  }
}

const stringPrims: Primitives = {
  "string-ref": {
    type: "(-> string number _ string)",
    value: (str: string, k: number) => {
      validBoundingIndex(str, k, k + 1);
      return str[k];
    }
  },
  substring: {
    type: "(-> string number number _ string)",
    value: (str: string, start: number, end: number) => {
      validBoundingIndex(str, start, end);
      return str.slice(start, end);
    }
  }
};

export default stringPrims;

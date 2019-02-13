interface Primitives {
  [name: string]: { type: string; value: unknown };
}

const prims: Primitives = {
  // log: {
  //   type: "(-> string string)",
  //   fn: (...args: any) => {
  //     /* tslint:disable:no-console */
  //     console.log(...args);
  //     /* tslint:enable:no-console */
  //     return
  //   }
  // },

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
  },

  "<": {
    type: "(-> number number boolean)",
    value: (a: number, b: number) => a < b
  },

  nil: {
    type: "(vector a)",
    value: []
  },

  cons: {
    type: "(-> a (vector a) (vector a))",
    value: <T>(a: T, list: T[]): T[] => [a, ...list]
  },

  first: {
    type: "(-> (vector a) a)",
    value: <T>(list: T[]): T => {
      if (list.length > 0) {
        return list[0];
      } else {
        throw Error("Cannot get first element of empty list");
      }
    }
  },

  rest: {
    type: "(-> (vector a) (vector a))",
    value: <T>(list: T[]): T[] => {
      if (list.length > 0) {
        const [, ...rest] = list;
        return rest;
      } else {
        throw Error("Cannot get first element of empty list");
      }
    }
  },

  "empty?": {
    type: "(-> (vector a) boolean)",
    value: <T>(list: T[]): boolean => list.length === 0
  }
};

export default prims;

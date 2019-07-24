import { readModule } from "../src/index";

describe("ReadModule", () => {
  it("should read all syntaxes", () => {
    expect(readModule(" (sum 1 2 3) (+ 4 5) (inc 6) ")).toMatchObject({
      tag: "module",
      body: [
        {
          node: {
            tag: "function-call",
            fn: {
              node: {
                tag: "variable-reference",
                name: "sum"
              }
            },
            userArguments: [
              { node: { tag: "number", value: 1 } },
              { node: { tag: "number", value: 2 } },
              { node: { tag: "number", value: 3 } }
            ]
          }
        },
        {
          node: {
            tag: "function-call",
            fn: {
              node: {
                tag: "variable-reference",
                name: "+"
              }
            },
            userArguments: [
              { node: { tag: "number", value: 4 } },
              { node: { tag: "number", value: 5 } }
            ]
          }
        },
        {
          node: {
            tag: "function-call",
            fn: {
              node: {
                tag: "variable-reference",
                name: "inc"
              }
            },
            userArguments: [{ node: { tag: "number", value: 6 } }]
          }
        }
      ]
    });
  });
});

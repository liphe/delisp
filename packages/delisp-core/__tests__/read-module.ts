import { readModule } from "../src/index";

describe("ReadModule", () => {
  it("should read all syntaxes", () => {
    expect(readModule(" (sum 1 2 3) (+ 4 5) (inc 6) ")).toMatchObject({
      type: "module",
      body: [
        {
          type: "function-call",
          fn: {
            type: "variable-reference",
            name: "sum"
          },
          args: [
            { type: "number", value: 1 },
            { type: "number", value: 2 },
            { type: "number", value: 3 }
          ]
        },
        {
          type: "function-call",
          fn: {
            type: "variable-reference",
            name: "+"
          },
          args: [{ type: "number", value: 4 }, { type: "number", value: 5 }]
        },
        {
          type: "function-call",
          fn: {
            type: "variable-reference",
            name: "inc"
          },
          args: [{ type: "number", value: 6 }]
        }
      ]
    });
  });
});

import { readModule } from "../src/index";

describe("ReadModule", () => {
  it("should read all syntaxes", () => {
    expect(readModule(" (sum 1 2 3) (+ 4 5) (inc 6) ")).toMatchObject({
      tag: "module",
      body: [
        {
          tag: "function-call",
          fn: {
            expr: {
              tag: "identifier",
              name: "sum"
            }
          },
          args: [
            { expr: { tag: "number", value: 1 } },
            { expr: { tag: "number", value: 2 } },
            { expr: { tag: "number", value: 3 } }
          ]
        },
        {
          tag: "function-call",
          fn: {
            expr: {
              tag: "identifier",
              name: "+"
            }
          },
          args: [
            { expr: { tag: "number", value: 4 } },
            { expr: { tag: "number", value: 5 } }
          ]
        },
        {
          tag: "function-call",
          fn: {
            expr: {
              tag: "identifier",
              name: "inc"
            }
          },
          args: [{ expr: { tag: "number", value: 6 } }]
        }
      ]
    });
  });
});

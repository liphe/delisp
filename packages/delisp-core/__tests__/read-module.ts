import { readModule } from "../src/index";

describe("ReadModule", () => {
  it("should read all syntaxes", () => {
    expect(readModule(" (sum 1 2 3) (+ 4 5) (inc 6) ")).toMatchObject({
      tag: "module",
      body: [
        {
          tag: "function-call",
          fn: {
            node: {
              tag: "identifier",
              name: "sum"
            }
          },
          args: [
            { node: { tag: "number", value: 1 } },
            { node: { tag: "number", value: 2 } },
            { node: { tag: "number", value: 3 } }
          ]
        },
        {
          tag: "function-call",
          fn: {
            node: {
              tag: "identifier",
              name: "+"
            }
          },
          args: [
            { node: { tag: "number", value: 4 } },
            { node: { tag: "number", value: 5 } }
          ]
        },
        {
          tag: "function-call",
          fn: {
            node: {
              tag: "identifier",
              name: "inc"
            }
          },
          args: [{ node: { tag: "number", value: 6 } }]
        }
      ]
    });
  });
});

import { readModule } from "../src/index";

describe("ReadModule", () => {
  it("should read all syntaxes", () => {
    expect(readModule(" (sum 1 2 3) (+ 4 5) (inc 6) ")).toMatchObject({
      tag: "module",
      body: [
        {
          tag: "function-call",
          fn: {
            tag: "identifier",
            name: "sum"
          },
          args: [
            { tag: "number", value: 1 },
            { tag: "number", value: 2 },
            { tag: "number", value: 3 }
          ]
        },
        {
          tag: "function-call",
          fn: {
            tag: "identifier",
            name: "+"
          },
          args: [{ tag: "number", value: 4 }, { tag: "number", value: 5 }]
        },
        {
          tag: "function-call",
          fn: {
            tag: "identifier",
            name: "inc"
          },
          args: [{ tag: "number", value: 6 }]
        }
      ]
    });
  });
});

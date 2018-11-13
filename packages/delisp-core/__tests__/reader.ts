import { readFromString } from "../src/";

describe("Reader", () => {
  // it("should read basic booleans", () => {
  //   expect(readFromString("true")).toEqual({
  //     type: "LiteralBoolean",
  //     value: true
  //   });

  //   expect(readFromString("false")).toEqual({
  //     type: "LiteralBoolean",
  //     value: false
  //   });
  // });

  it("should read basic expessions", () => {
    expect(readFromString("1")).toEqual({ type: "LiteralNumber", value: 1 });

    expect(readFromString("x")).toEqual({ type: "LiteralSymbol", value: "x" });

    expect(readFromString("()")).toEqual({ type: "List", value: [] });

    expect(readFromString("(1 2)")).toEqual({
      type: "List",
      value: [
        { type: "LiteralNumber", value: 1 },
        { type: "LiteralNumber", value: 2 }
      ]
    });

    // expect(readFromString("(whatever (stuff)"))
  });

  it("should parse nested lists", () => {
    expect(readFromString(" ( 1 ( 2 ) 3 )")).toEqual({
      type: "List",
      value: [
        { type: "LiteralNumber", value: 1 },
        {
          type: "List",
          value: [{ type: "LiteralNumber", value: 2 }]
        },
        { type: "LiteralNumber", value: 3 }
      ]
    });
  });
});

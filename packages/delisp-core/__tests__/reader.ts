import { readFromString } from "../src/reader";

describe("Reader", () => {
  it("should read basic expressions", () => {
    expect(readFromString("12")).toMatchSnapshot();
    expect(readFromString("  12  ")).toMatchSnapshot();
    expect(readFromString("  xyz  ")).toMatchSnapshot();
    expect(readFromString("()")).toMatchSnapshot();
    expect(readFromString("(  )")).toMatchSnapshot();
    expect(readFromString("(1 2 3)")).toMatchSnapshot();
    expect(readFromString("(1 ( 2 ) 3)")).toMatchSnapshot();
  });

  // it.skip("should read basic expessions", () => {
  //   expect(readFromString("1")).toEqual({ type: "LiteralNumber", value: 1 });
  //   expect(readFromString("x")).toEqual({ type: "LiteralSymbol", value: "x" });
  //   expect(readFromString("()")).toEqual({ type: "List", value: [] });
  //   expect(readFromString("(1 2)")).toEqual({
  //     type: "List",
  //     value: [
  //       { type: "LiteralNumber", value: 1 },
  //       { type: "LiteralNumber", value: 2 }
  //     ]
  //   });
  //   // expect(readFromString("(whatever (stuff)"))
  // });
  // it.skip("should parse nested lists", () => {
  //   expect(readFromString(" ( 1 ( 2 ) 3 )")).toEqual({
  //     type: "List",
  //     value: [
  //       { type: "LiteralNumber", value: 1 },
  //       {
  //         type: "List",
  //         value: [{ type: "LiteralNumber", value: 2 }]
  //       },
  //       { type: "LiteralNumber", value: 3 }
  //     ]
  //   });
  // });
});

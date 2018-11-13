import { readFromString } from "../src/";

describe("Reader", () => {
  it("should read basic booleans", () => {
    expect(readFromString("true")).toEqual({
      type: "LiteralBoolean",
      value: true
    });

    expect(readFromString("false")).toEqual({
      type: "LiteralBoolean",
      value: false
    });
  });
});

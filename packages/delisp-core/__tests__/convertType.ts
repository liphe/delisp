import { convert } from "../src/convertType";
import { readFromString } from "../src/reader";

describe("ConvertType", () => {
  it("should convert to numbers", () => {
    expect(convert(readFromString("number"))).toMatchObject({ type: "number" });
    expect(convert(readFromString("  number  "))).toMatchObject({
      type: "number"
    });
  });

  it("should convert to strings", () => {
    expect(convert(readFromString("string"))).toMatchObject({ type: "string" });
    expect(convert(readFromString("  string  "))).toMatchObject({
      type: "string"
    });
  });

  it("should convert to symbols", () => {
    expect(convert(readFromString("a"))).toMatchObject({
      type: "type-variable",
      name: "a"
    });
    expect(convert(readFromString("  b  "))).toMatchObject({
      type: "type-variable",
      name: "b"
    });
  });

  it("should convert to functions", () => {
    expect(convert(readFromString("  (->  string  number)  "))).toMatchObject({
      type: "application",
      op: "->",
      args: [{ type: "string" }, { type: "number" }]
    });

    expect(
      convert(readFromString("(-> string (-> string c) c)"))
    ).toMatchObject({
      type: "application",
      op: "->",
      args: [
        { type: "string" },
        {
          type: "application",
          op: "->",
          args: [{ type: "string" }, { type: "type-variable", name: "c" }]
        },
        { type: "type-variable", name: "c" }
      ]
    });
  });
});

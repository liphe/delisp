import { readFromString } from "../src/reader";
import { convert } from "../src/convertType";

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
    expect(convert(readFromString("  (-> ( string ) number)  "))).toMatchObject(
      {
        type: "function",
        from: [{ type: "string" }],
        to: { type: "number" }
      }
    );
    expect(
      convert(readFromString("(-> (string (-> (string) c)) c)"))
    ).toMatchObject({
      type: "function",
      from: [
        { type: "string" },
        {
          type: "function",
          from: [{ type: "string" }],
          to: { type: "type-variable", name: "c" }
        }
      ],
      to: { type: "type-variable", name: "c" }
    });
  });
});

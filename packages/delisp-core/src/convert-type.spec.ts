import { readFromString } from "../src/reader";
import { convert } from "./convert-type";

describe("convertType", () => {
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

  it("should detect incorrect types", () => {
    expect(() => convert(readFromString("1"))).toThrowError("Not a valid type");

    expect(() => convert(readFromString(`"hello"`))).toThrowError(
      "Not a valid type"
    );

    expect(() => convert(readFromString(`(fn)`))).toThrowError(
      "Expected at least 2 arguments"
    );

    expect(() => convert(readFromString(`(fn a)`))).toThrowError(
      "Expected at least 2 arguments"
    );

    expect(() => convert(readFromString("(1 2 3)"))).toThrowError(
      "Expected symbol as operator"
    );

    expect(() => convert(readFromString(`("hello" "world")`))).toThrowError(
      "Expected symbol as operator"
    );
  });
});

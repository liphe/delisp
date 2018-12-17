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
    function failedType(x: string) {
      let result: string | undefined;
      try {
        convert(readFromString(x));
      } catch (err) {
        result = `\n${err.message}`;
      }
      if (result) {
        return result;
      } else {
        throw new Error(`The type is expected to fail`);
      }
    }

    expect(failedType("1")).toMatchSnapshot();
    expect(failedType(`"hello"`)).toMatchSnapshot();
    expect(failedType(`(fn)`)).toMatchSnapshot();
    expect(failedType(`(fn a)`)).toMatchSnapshot();
    expect(failedType("(1 2 3)")).toMatchSnapshot();
    expect(failedType(`("hello" "world")`)).toMatchSnapshot();
  });
});

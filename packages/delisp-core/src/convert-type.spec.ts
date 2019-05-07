import { readFromString } from "../src/reader";
import { convert } from "./convert-type";
import { tFn, tNumber, tString, tVar, Type } from "./types";
import { printType } from "./type-printer";

describe("convertType", () => {
  it("should convert to numbers", () => {
    expect(convert(readFromString("number"))).toMatchObject(tNumber);
    expect(convert(readFromString("  number  "))).toMatchObject(tNumber);
  });

  it("should convert to strings", () => {
    expect(convert(readFromString("string"))).toMatchObject(tString);
    expect(convert(readFromString("  string  "))).toMatchObject(tString);
  });

  it("should convert to symbols", () => {
    expect(convert(readFromString("a"))).toMatchObject(tVar("a"));
    expect(convert(readFromString("  b  "))).toMatchObject(tVar("b"));
  });

  it("should convert to functions", () => {
    expect(convert(readFromString("  (->  string _ number)  "))).toMatchObject(
      tFn([tString], tVar("_"), tNumber)
    );

    expect(
      convert(readFromString("(-> string (-> string _ c) _ c)"))
    ).toMatchObject(
      tFn([tString, tFn([tString], tVar("_"), tVar("c"))], tVar("_"), tVar("c"))
    );
  });

  it("should read extensible record", () => {
    expect(
      convert(readFromString("{:x number :y number | a}"))
    ).toMatchSnapshot();
  });

  it("should fail for invalid syntax of extensible records", () => {
    expect(() => {
      convert(readFromString("{| a :x number}"));
    }).toThrow();
  });

  it("should fail for duplicated labels of extensible records", () => {
    expect(() => {
      convert(readFromString("{:x 10 :x 20}"));
    }).toThrow();
  });

  it("should detect incorrect types", () => {
    function failedType(x: string) {
      let result: Type | string;

      try {
        result = convert(readFromString(x)).instantiate();
      } catch (err) {
        result = `\n${err.message}`;
      }

      if (typeof result === "string") {
        return result;
      } else {
        throw new Error(
          `The type is expected to fail, but returned ${printType(
            result,
            false
          )}`
        );
      }
    }

    expect(failedType("1")).toMatchSnapshot();
    expect(failedType(`"hello"`)).toMatchSnapshot();
    expect(failedType("(1 2 3)")).toMatchSnapshot();
    expect(failedType(`("hello" "world")`)).toMatchSnapshot();
    expect(failedType(`(effect 1`)).toMatchSnapshot();
  });

  describe("Effects", () => {
    it("should convert empty effect", () => {
      expect(convert(readFromString("(effect)"))).toMatchSnapshot();
    });

    it("should convert simple effect with one labrel", () => {
      expect(convert(readFromString("(effect console)"))).toMatchSnapshot();
    });

    it("should convert effect with multiple labels", () => {
      expect(
        convert(readFromString("(effect console async)"))
      ).toMatchSnapshot();
    });

    it("should convert open effect with multiple labels", () => {
      expect(
        convert(readFromString("(effect console async | a)"))
      ).toMatchSnapshot();
    });
  });
});

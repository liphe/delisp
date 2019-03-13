import { readFromString } from "../src/reader";
import { convert } from "./convert-type";
import { tFn, tNumber, tString, tVar } from "./types";

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
    expect(convert(readFromString("  (->  string  number)  "))).toMatchObject(
      tFn([tString], tNumber)
    );

    expect(
      convert(readFromString("(-> string (-> string c) c)"))
    ).toMatchObject(tFn([tString, tFn([tString], tVar("c"))], tVar("c")));
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

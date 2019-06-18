import { readFromString } from "../src/reader";
import { convert as convert_ } from "./convert-type";
import { tFn, tNumber, tString, tVar, Type } from "./types";
import { printType } from "./type-printer";

function readAndConvert(x: string) {
  return convert_(readFromString(x)).noWildcards();
}

function failedType(x: string) {
  let result: Type | string;

  try {
    result = readAndConvert(x);
  } catch (err) {
    result = `\n${err.message}`;
  }

  if (typeof result === "string") {
    return result;
  } else {
    throw new Error(
      `The type is expected to fail, but returned ${printType(result, false)}`
    );
  }
}

describe("convertType", () => {
  it("should convert to numbers", () => {
    expect(readAndConvert("number")).toMatchObject(tNumber);
    expect(readAndConvert("  number  ")).toMatchObject(tNumber);
  });

  it("should convert to strings", () => {
    expect(readAndConvert("string")).toMatchObject(tString);
    expect(readAndConvert("  string  ")).toMatchObject(tString);
  });

  it("should convert to symbols", () => {
    expect(readAndConvert("a")).toMatchObject(tVar("a"));
    expect(readAndConvert("  b  ")).toMatchObject(tVar("b"));
  });

  it("should convert to functions", () => {
    expect(readAndConvert("  (->  string _ number)  ")).toMatchObject(
      tFn([tString], tVar("_"), tNumber)
    );

    expect(readAndConvert("(-> string (-> string _ c) _ c)")).toMatchObject(
      tFn([tString, tFn([tString], tVar("_"), tVar("c"))], tVar("_"), tVar("c"))
    );
  });

  it("should read extensible record", () => {
    expect(readAndConvert("{:x number :y number | a}")).toMatchSnapshot();
  });

  it("should fail for invalid syntax of extensible records", () => {
    expect(() => {
      readAndConvert("{| a :x number}");
    }).toThrow();
  });

  it("should fail for duplicated labels of extensible records", () => {
    expect(() => {
      readAndConvert("{:x 10 :x 20}");
    }).toThrow();
  });

  it("should detect incorrect types", () => {
    expect(failedType("1")).toMatchSnapshot();
    expect(failedType(`"hello"`)).toMatchSnapshot();
    expect(failedType("(1 2 3)")).toMatchSnapshot();
    expect(failedType(`("hello" "world")`)).toMatchSnapshot();
    expect(failedType(`(effect 1`)).toMatchSnapshot();
  });

  describe("Effects", () => {
    it("should convert empty effect", () => {
      expect(readAndConvert("(effect)")).toMatchSnapshot();
    });

    it("should convert simple effect with one labrel", () => {
      expect(readAndConvert("(effect console)")).toMatchSnapshot();
    });

    it("should convert effect with multiple labels", () => {
      expect(readAndConvert("(effect console async)")).toMatchSnapshot();
    });

    it("should convert open effect with multiple labels", () => {
      expect(readAndConvert("(effect console async | a)")).toMatchSnapshot();
    });
  });

  describe("Cases", () => {
    it("should read empty case", () => {
      expect(readAndConvert("(cases)")).toMatchSnapshot();
    });
    it("should read fully polymorphic case", () => {
      expect(readAndConvert("(cases a)")).toMatchSnapshot();
    });
    it("should read basic case", () => {
      expect(
        readAndConvert("(cases (:person string) (:machine number))")
      ).toMatchSnapshot();
    });

    it("should detect incorrect cases", () => {
      expect(failedType(`(cases {} {})`)).toMatchSnapshot();
    });
  });
});

import { readSyntax, isDeclaration } from "../src/index";
import { inferType } from "../src/infer";
import { printType } from "../src/type-utils";

function typeOf(str: string): any {
  const syntax = readSyntax(str);
  if (isDeclaration(syntax)) {
    throw new Error(`Not an expression!`);
  }
  return printType(inferType(syntax));
}

describe("Type inference", () => {
  describe("Numbers", () => {
    it("should self-evaluate", () => {
      expect(typeOf("0")).toBe("number");
      expect(typeOf("1")).toBe("number");
      expect(typeOf("-1")).toBe("number");
    });
  });

  describe("Strings", () => {
    it("should self-evaluate", () => {
      expect(typeOf('""')).toBe("string");
      expect(typeOf('"foo"')).toBe("string");
      expect(typeOf('"a\\nb"')).toBe("string");
    });
  });

  // describe("Function calls", () => {
  //   it("should evaluate to the right value", () => {
  //     expect(typeOf("(+ 1 2)")).toBe(3);
  //     expect(typeOf("(+ (+ 1 1) 2)")).toBe(4);
  //   });
  // });

  describe("Lambda abstractions", () => {
    it("identity function should", () => {
      expect(typeOf("(lambda (x) x)")).toBe("(-> α α)");
    });
  });
});

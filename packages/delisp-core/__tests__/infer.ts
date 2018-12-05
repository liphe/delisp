import { readType, readSyntax, isDeclaration } from "../src/index";
import { inferType, TypeEnvironment } from "../src/infer";
import { printType } from "../src/type-utils";

function typeOf(str: string, env: TypeEnvironment = {}): any {
  const syntax = readSyntax(str);
  if (isDeclaration(syntax)) {
    throw new Error(`Not an expression!`);
  }
  return printType(inferType(syntax, env));
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

  describe("Function calls", () => {
    it("should have the right type", () => {
      const env = {
        "+": readType("(-> number number number)")
      };
      expect(typeOf("(+ 1 2)", env)).toBe("number");
      expect(typeOf("(+ (+ 1 1) 2)", env)).toBe("number");
      expect(typeOf("(lambda (x) (+ x 1))", env)).toBe("(-> number number)");
    });
  });

  describe("Lambda abstractions", () => {
    it("should infer the right type", () => {
      expect(typeOf("(lambda (x) x)")).toBe("(-> α α)");
      expect(typeOf("(lambda (x y) y)")).toBe("(-> α β β)");
      expect(typeOf("(lambda (f x) (f x))")).toBe("(-> (-> α β) α β)");
      expect(typeOf("(lambda (f x) (f x))")).toBe("(-> (-> α β) α β)");
      expect(typeOf("(lambda (x) (lambda (y) x))")).toBe("(-> α (-> β α))");
    });
  });
});

import { readSyntax, isDeclaration } from "../src/index";
import { inferType, TypeEnvironment } from "../src/infer";
import { readType, printType } from "../src/type-utils";

function typeOf(str: string, env: TypeEnvironment = {}): string {
  const syntax = readSyntax(str);
  if (isDeclaration(syntax)) {
    throw new Error(`Not an expression!`);
  }
  const typedExpr = inferType(syntax, env);
  return printType(typedExpr.info.type);
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
        length: readType("(-> string int)"),
        "+": readType("(-> number number number)"),
        const: readType("(-> a (-> b a))")
      };
      expect(typeOf("(+ 1 2)", env)).toBe("number");
      expect(typeOf("(+ (+ 1 1) 2)", env)).toBe("number");
      expect(typeOf("(lambda (x) (+ x 1))", env)).toBe("(-> number number)");
      expect(typeOf("(const 5)", env)).toBe("(-> α number)");
      expect(typeOf(`((const 5) "foo")`, env)).toBe("number");
      expect(typeOf(`(+ ((const 5) "foo") ((const 5) 23))`, env)).toBe(
        "number"
      );

      expect(() => typeOf(`(+ "foo" 3`)).toThrow();
    });

    describe("Lambda abstractions", () => {
      it("should infer the right type", () => {
        expect(typeOf("(lambda (x) x)")).toBe("(-> α α)");
        expect(typeOf("(lambda (x y) y)")).toBe("(-> α β β)");
        expect(typeOf("(lambda (f x) (f x))")).toBe("(-> (-> α β) α β)");
        expect(typeOf("(lambda (f x) (f x))")).toBe("(-> (-> α β) α β)");
        expect(typeOf("(lambda (x) (lambda (y) x))")).toBe("(-> α (-> β α))");
        // lambda-bound variables should be monomorphic
        expect(() => typeOf(`(lambda (f) ((f "foo") (f 0)))`)).toThrow();
      });

      it("should return the type of the last form", () => {
        expect(typeOf("(lambda (x) 1)")).toBe("(-> α number)");
      });
    });

    describe("Let polymorphism", () => {
      it("should generalize basic types in let", () => {
        expect(typeOf("(let ((id (lambda (x) x))) id)")).toBe("(-> α α)");
      });
    });

    describe("Lists", () => {
      it("should infer the type of empty vector", () => {
        expect(typeOf("[]")).toBe("[α]");
      });
      it("should infer the type of a vector of numbers", () => {
        expect(typeOf("[1 2 3]")).toBe("[number]");
      });
      it("should infer the type of nested vectors", () => {
        expect(typeOf("[[1] [2] [3]]")).toBe("[[number]]");
      });
    });

    describe("Records", () => {
      it("should infer the type of exact records", () => {
        expect(typeOf('{x 10 y "hello"}')).toBe("{x number y string}");
      });
      it("should infer the type of a field selector", () => {
        expect(typeOf(".x")).toBe("(-> {x α | β} α)");
        expect(typeOf(".foo")).toBe("(-> {foo α | β} α)");
        expect(typeOf("(if true .x .y)")).toBe("(-> {x α y α | β} α)");
      });
      it("should be able to access the field", () => {
        expect(typeOf("(.x {x 5})")).toBe("number");
        expect(typeOf("(lambda (f) (f {x 5 y 6}))")).toBe(
          "(-> (-> {x number y number} α) α)"
        );
      });
      it("should throw an error when trying to access unknown fields", () => {
        expect(() => typeOf("(.x {y 2})")).toThrow();
        expect(() => typeOf("(.x {})")).toThrow();
      });
    });

    describe("Conditionals", () => {
      it("should infer the right type when both branches return the same type", () => {
        expect(typeOf("(if true 1 0)")).toBe("number");
      });
      it("should ensure both branches' types are instantiated properly", () => {
        expect(typeOf("(if true [] [1])")).toBe("[number]");
      });
    });
  });
});

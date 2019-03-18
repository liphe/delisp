import { isDeclaration, readSyntax } from "../src/index";
import {
  ExternalEnvironment,
  inferType,
  InternalTypeEnvironment
} from "../src/infer";
import { printType, readType } from "../src/type-utils";

function typeOf(
  str: string,
  externalEnv: ExternalEnvironment = { variables: {}, types: {} },
  internalEnv: InternalTypeEnvironment = {}
): string {
  const syntax = readSyntax(str);
  if (isDeclaration(syntax)) {
    throw new Error(`Not an expression!`);
  }
  const typedExpr = inferType(syntax, externalEnv, internalEnv);
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
        variables: {
          length: readType("(-> string int)"),
          "+": readType("(-> number number number)"),
          const: readType("(-> a (-> b a))")
        },
        types: {}
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
        expect(typeOf("(let {id (lambda (x) x)} id)")).toBe("(-> α α)");
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
        expect(typeOf('{:x 10 :y "hello"}')).toBe("{:x number :y string}");
      });
      it("should infer the type of a field selector", () => {
        expect(typeOf(":x")).toBe("(-> {:x α | β} α)");
        expect(typeOf(":foo")).toBe("(-> {:foo α | β} α)");
        expect(typeOf("(if true :x :y)")).toBe("(-> {:x α :y α | β} α)");
      });
      it("should be able to access the field", () => {
        expect(typeOf("(:x {:x 5})")).toBe("number");
        expect(typeOf("(lambda (f) (f {:x 5 :y 6}))")).toBe(
          "(-> (-> {:x number :y number} α) α)"
        );
      });
      it("should throw an error when trying to access unknown fields", () => {
        expect(() => typeOf("(:x {:y 2})")).toThrow();
        expect(() => typeOf("(:x {})")).toThrow();
      });
      it("should infer the type of updating record fields", () => {
        expect(typeOf("{:x 2 | {:x 1}}")).toBe("{:x number}");
        expect(typeOf('{:x "foo" | {:x 1}}')).toBe("{:x string}");
        expect(typeOf("{:x 3 | (if true {:x 1} {:x 2})}")).toBe("{:x number}");
        expect(typeOf("(lambda (r v) {:x v | r})")).toBe(
          "(-> {:x α | β} γ {:x γ | β})"
        );
      });
      it("should not allow to extend a record", () => {
        expect(() => typeOf("{:y 2 | {:x 1}}")).toThrow();
      });
      it("should not allow to extend any other type", () => {
        expect(() => typeOf("{:x 1 | 5}")).toThrow();
        expect(() => typeOf('{:x 1 | "foo"}')).toThrow();
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

    describe("Type annotations", () => {
      it("user-specified variables can specialize inferred types", () => {
        expect(typeOf("(the [number] [])")).toBe("[number]");
      });

      it("user-specified variables can be isomorphic to inferred types", () => {
        expect(typeOf("(the [a] [])")).toBe("[α]");
      });

      it("user-specified variables cannot generalize inferred types", () => {
        expect(() => typeOf(`(the a 3)`)).toThrow();
        expect(() =>
          typeOf(`(the (-> a a) (the (-> string string) (lambda (x) x)))`)
        ).toThrow();
      });

      it("supports partial type annotations", () => {
        expect(typeOf('(the [_a] ["foo"])')).toBe("[string]");
        expect(typeOf("(the (-> _a _b) (lambda (x) 42))")).toBe(
          "(-> α number)"
        );
        expect(typeOf("(the (-> _a _b) (lambda (x) (+ x 42)))")).toBe(
          "(-> number number)"
        );

        expect(typeOf(`(lambda (f) ((the (-> _a _b _c) f) 42 "foo"))`)).toBe(
          "(-> (-> number string α) α)"
        );
        expect(() =>
          typeOf(`(lambda (f) ((the (-> _a _a _c) f) 42 "foo"))`)
        ).toThrow();

        expect(typeOf(`(lambda (f) ((the (-> _ _ _) f) 42 "foo"))`)).toBe(
          "(-> (-> number string α) α)"
        );
      });

      it.skip("`_` should not be equal to any named wildcard _<name>", () => {
        expect(typeOf(`(the (-> _ __t1) (lambda (x) (print x) 42))`)).toBe(
          "(-> string number)"
        );
      });
    });

    describe("User-defined type", () => {
      const env = { variables: {}, types: { ID: readType("number").mono } };

      it("should NOT be compatible", () => {
        expect(() => typeOf("(if true (the ID 5) 3)", env)).toThrow();
      });

      it("should NOT expand to their definition", () => {
        expect(typeOf("(lambda (x) (the ID x))", env)).toBe("(-> ID ID)");
      });
    });

    describe("Type aliases", () => {
      const env = { variables: {}, types: {} };
      const intEnv: InternalTypeEnvironment = {
        ID: readType("number").mono,
        Person: readType("{:x string}").mono
      };

      it("should be compatible if they are internal", () => {
        expect(typeOf("(if true (the ID 5) 3)", env, intEnv)).not.toBe("α");
      });

      it("should expand to their definition if they are internal", () => {
        expect(typeOf("(the ID 5)", env, intEnv)).toBe("number");
      });

      it("should be compatible when defined as a record", () => {
        expect(typeOf('(the Person {:name "david"})', env, intEnv)).toBe(
          "{:name string}"
        );
      });
    });
  });
});

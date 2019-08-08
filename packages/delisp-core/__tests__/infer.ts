import { readType } from "../src/type-convert";
import {
  defaultEnvironment,
  inferExpressionInModule,
  inferModule
} from "../src/infer";
import { ExternalEnvironment } from "../src/infer-environment";
import * as S from "../src/syntax";
import { Typed } from "../src/syntax-typed";
import { createModule, readModule } from "../src/module";
import { WithErrors, readSyntax } from "../src/syntax-convert";
import { macroexpandExpression } from "../src/macroexpand";
import { printType } from "../src/type-printer";

function normalizeType(t: string): string {
  return printType(readType(t).mono);
}

expect.extend({
  toBeType(received, type) {
    const expected = normalizeType(type);
    if (expected === received) {
      return {
        message: () => `works`,
        pass: true
      };
    } else {
      return {
        message: () => `Received: ${received}\nExpected: ${expected}`,
        pass: false
      };
    }
  }
});

function inferType(
  expr: S.Expression,
  env: ExternalEnvironment = defaultEnvironment,
  m: S.Module<Typed, {}> = createModule(),
  multipleValues: boolean
): S.Expression<Typed> {
  const infer = inferExpressionInModule(expr, m, env, multipleValues);

  const unknowns = infer.unknowns.filter(u => u.node.name !== "*context*");
  if (unknowns.length > 0) {
    throw new Error(
      `Unknown variables ${infer.unknowns.map(v => v.node.name).join(" ")}`
    );
  }
  return infer.typedExpression;
}

/* eslint-disable @typescript-eslint/no-namespace */
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeType(t: string): R;
    }
  }
}
/* eslint-enable @typescript-eslint/no-namespace */

function readExpr(code: string): S.Expression<WithErrors> {
  const syntax = readSyntax(code);
  if (S.isDeclaration(syntax)) {
    throw new Error(`Not an expression!`);
  }
  return syntax;
}

const emptyExternalEnv: ExternalEnvironment = { variables: {}, types: {} };

function typeOf(
  str: string,
  externalEnv: ExternalEnvironment = emptyExternalEnv,
  moduleCode: string = "",
  multipleValues = false
): string {
  const syntax = readExpr(str);
  const expandedSyntax = macroexpandExpression(syntax);

  const m = readModule(moduleCode);
  const { typedModule } = inferModule(m, externalEnv);

  const typedExpr = inferType(
    expandedSyntax,
    externalEnv,
    typedModule,
    multipleValues
  );
  const result = printType(typedExpr.info.resultingType);
  return result;
}

describe("Type inference", () => {
  describe("Numbers", () => {
    it("should self-evaluate", () => {
      expect(typeOf("0")).toBeType("number");
      expect(typeOf("1")).toBeType("number");
      expect(typeOf("-1")).toBeType("number");
    });
  });

  describe("Strings", () => {
    it("should self-evaluate", () => {
      expect(typeOf('""')).toBeType("string");
      expect(typeOf('"foo"')).toBeType("string");
      expect(typeOf('"a\\nb"')).toBeType("string");
    });
  });

  describe("Function calls", () => {
    it("should have the right type", () => {
      const env = {
        variables: {
          length: readType("(-> ctx string _ int)"),
          "+": readType("(-> ctx number number _ number)"),
          const: readType("(-> ctx1 a _ (-> ctx2 b _ a))")
        },

        types: {}
      };
      expect(typeOf("(+ 1 2)", env)).toBeType("number");
      expect(typeOf("(+ (+ 1 1) 2)", env)).toBeType("number");
      expect(typeOf("(lambda (x) (+ x 1))", env)).toBeType(
        "(-> ctx number α number)"
      );
      expect(typeOf("(const 5)", env)).toBeType("(-> ctx α γ number)");
      expect(typeOf(`((const 5) "foo")`, env)).toBeType("number");
      expect(typeOf(`(+ ((const 5) "foo") ((const 5) 23))`, env)).toBeType(
        "number"
      );

      expect(() => typeOf(`(+ "foo" 3`)).toThrow();
    });

    describe("Lambda abstractions", () => {
      it("should infer the right type", () => {
        expect(typeOf("(lambda (x) x)")).toBeType("(-> ctx β γ β)");
        expect(typeOf("(lambda (x y) y)")).toBeType("(-> ctx α β γ β)");
        expect(typeOf("(lambda (f x) (f x))")).toBeType(
          "(-> ctx (-> ctx x e (values r <| rs)) x e (values r <| rs))"
        );
        expect(typeOf("(lambda (x) (lambda (y) x))")).toBeType(
          "(-> ctx1 α β (-> ctx2 γ δ α))"
        );
        // lambda-bound variables should be monomorphic
        expect(() => typeOf(`(lambda (f) ((f "foo") (f 0)))`)).toThrow();
      });

      it("should return the type of the last form", () => {
        expect(typeOf("(lambda (x) 1)")).toBeType("(-> ctx α β number)");
      });
    });

    describe("Let polymorphism", () => {
      it("should generalize basic types in let", () => {
        expect(typeOf("(let {id (lambda (x) x)} id)")).toBeType(
          "(-> ctx α β α)"
        );
      });

      it("should shadow inline primitivres", () => {
        expect(typeOf("(let {+ 10} +)")).toBeType("number");
      });
    });

    describe("Lists", () => {
      it("should infer the type of empty vector", () => {
        expect(typeOf("[]")).toBeType("[α]");
      });
      it("should infer the type of a vector of numbers", () => {
        expect(typeOf("[1 2 3]")).toBeType("[number]");
      });
      it("should infer the type of nested vectors", () => {
        expect(typeOf("[[1] [2] [3]]")).toBeType("[[number]]");
      });
    });

    describe("Records", () => {
      it("should infer the type of exact records", () => {
        expect(typeOf('{:x 10 :y "hello"}')).toBeType("{:x number :y string}");
      });
      it("should infer the type of a lenses", () => {
        expect(typeOf(":x")).toBeType(
          "(-> ctx1 {:x α <| β} γ (values α (-> ctx2 δ ε {:x δ <| β})))"
        );
        expect(typeOf(":foo")).toBeType(
          "(-> ctx1 {:foo α <| β} γ (values α (-> ctx2 δ ε {:foo δ <| β})))"
        );
        expect(typeOf("(if true :x :y)")).toBeType(
          "(-> ctx1 {:x α :y α <| β} γ (values α (-> ctx2 α δ {:x α :y α <| β})))"
        );
      });
      it("should be able to access the field", () => {
        expect(typeOf("(:x {:x 5})", undefined, undefined, true)).toBeType(
          "(values number (-> ctx α β {:x α}))"
        );
        expect(typeOf("(lambda (f) (f {:x 5 :y 6}))")).toBeType(
          "(-> ctx (-> ctx {:x number :y number} α (values β <| γ)) α (values β <| γ))"
        );
      });
      it("should throw an error when trying to access unknown fields", () => {
        expect(() => typeOf("(:x {:y 2})")).toThrow();
        expect(() => typeOf("(:x {})")).toThrow();
      });
      it("should infer the type of updating record fields", () => {
        expect(typeOf("{:x 2 | {:x 1}}")).toBeType("{:x number}");
        expect(typeOf('{:x "foo" | {:x 1}}')).toBeType("{:x string}");
        expect(typeOf("{:x 3 | (if true {:x 1} {:x 2})}")).toBeType(
          "{:x number}"
        );
        expect(typeOf("(lambda (r v) {:x v | r})")).toBeType(
          "(-> ctx {:x α <| β} γ δ {:x γ <| β})"
        );
      });
      it("should not allow to extend a record", () => {
        expect(() => typeOf("{:y 2 | {:x 1}}")).toThrow();
      });
      it("should not allow to extend any other type", () => {
        expect(() => typeOf("{:x 1 | 5}")).toThrow();
        expect(() => typeOf('{:x 1 | "foo"}')).toThrow();
      });

      it("infer the selector type of record lenses", () => {
        expect(typeOf("(multiple-value-bind (x _) (:x {:x 20}) x)")).toBeType(
          "number"
        );
        expect(typeOf("(multiple-value-bind (_ u) (:x {:x 20}) u)")).toBeType(
          "(-> ctx α β {:x α})"
        );
      });
    });

    describe("Cases", () => {
      it("should infer the type of injected cases", () => {
        expect(typeOf("(case :version 0)")).toBeType(
          "(cases (:version number) α)"
        );
      });
      it("should infer the type of match", () => {
        expect(
          typeOf(`
(lambda (x)
  (match x
    ({:version number} number)
    ({:unreleased _} -1)))
`)
        ).toBeType(
          "(-> ctx (cases (:version number) (:unreleased α)) β number)"
        );
      });

      it("match can handle cases", () => {
        expect(
          typeOf(`
(match (case :version 2)
  ({:version number} number)
  ({:unreleased _} -1))`)
        ).toBeType("number");
      });

      it("unexpected cases are not allowed", () => {
        expect(() =>
          typeOf(`
(match (case :test "foo")
  ({:version number} number)
  ({:unreleased _} -1))`)
        ).toThrow();
      });

      it("cases with the wrong type are not allowed", () => {
        expect(() =>
          typeOf(`
(match (case :version "foo")
  ({:version number} number)
  ({:unreleased _} -1))`)
        ).toThrow();
      });

      it("match can handle a default case", () => {
        expect(
          typeOf(`
(lambda (x)
  (match x
    ({:version number} number)
    ({:unreleased _} -1)
    (:default -2)))
`)
        ).toBeType(
          "(-> ctx (cases (:version number) (:unreleased α) β) γ number)"
        );
      });

      it("match can handle a default case", () => {
        expect(
          typeOf(`
(lambda (state action)
  (match action
    ({:foo _} "hello")
    (:default state)))
`)
        ).toBeType("(-> ctx string (cases (:foo α) β) γ string)");
      });

      it("match case variables should not be visible outside of the body", () => {
        expect(() =>
          typeOf(`
(match (case :version 1)
  ({:version v}
    v)
  (:default
    (string-length v)))`)
        ).toThrow();
      });
    });

    describe("Conditionals", () => {
      it("should infer the right type when both branches return the same type", () => {
        expect(typeOf("(if true 1 0)")).toBeType("number");
      });
      it("should ensure both branches' types are instantiated properly", () => {
        expect(typeOf("(if true [] [1])")).toBeType("[number]");
      });
    });

    describe("Type annotations", () => {
      it("user-specified variables can specialize inferred types", () => {
        expect(typeOf("(the [number] [])")).toBeType("[number]");
      });

      it("user-specified variables can be isomorphic to inferred types", () => {
        expect(typeOf("(the [a] [])")).toBeType("[α]");
      });

      it("user-specified variables cannot generalize inferred types", () => {
        expect(() => typeOf(`(the a 3)`)).toThrow();
        expect(() =>
          typeOf(
            `(the (-> ctx a a) (the (-> ctx string string) (lambda (x) x)))`
          )
        ).toThrow();
      });

      it("supports partial type annotations", () => {
        expect(typeOf('(the [_a] ["foo"])')).toBeType("[string]");
        expect(typeOf("(the (-> ctx _a _ _b) (lambda (x) 42))")).toBeType(
          "(-> ctx α β number)"
        );
        expect(typeOf("(the (-> ctx _a _ _b) (lambda (x) (+ x 42)))")).toBeType(
          "(-> ctx number (effect <| α) number)"
        );

        expect(
          typeOf(`(lambda (f) ((the (-> cstx _a _b _c _d) f) 42 "foo"))`)
        ).toBeType("(-> ctx (-> ctx number string α β) α β)");
        expect(() =>
          typeOf(`(lambda (f) ((the (-> ctx _a _a _ _c) f) 42 "foo"))`)
        ).toThrow();

        expect(
          typeOf(`(lambda (f) ((the (-> ctx _ _ _e _) f) 42 "foo"))`)
        ).toBeType("(-> ctx (-> ctx number string α β) α β)");
      });

      it.skip("`_` should not be equal to any named wildcard _<name>", () => {
        expect(
          typeOf(`(the (-> ctx _ __t1) (lambda (x) (print x) 42))`)
        ).toBeType("(-> ctx string number)");
      });
    });

    describe("User-defined type", () => {
      const env = { variables: {}, types: { ID: readType("number") } };

      it("should NOT be compatible", () => {
        expect(() => typeOf("(if true (the ID 5) 3)", env)).toThrow();
      });

      it("should NOT expand to their definition", () => {
        expect(typeOf("(lambda (x) (the ID x))", env)).toBeType(
          "(-> ctx ID α ID)"
        );
      });
    });

    describe("Type aliases", () => {
      const env = { variables: {}, types: {} };
      const m = `
        (type ID number)
        (type Person {:name string})
      `;

      it("should be compatible if they are internal", () => {
        expect(typeOf("(if true (the ID 5) 3)", env, m)).not.toBeType("α");
      });

      it("should expand to their definition if they are internal", () => {
        expect(typeOf("(the ID 5)", env, m)).toBeType("number");
      });

      it("should be compatible when defined as a record", () => {
        expect(typeOf('(the Person {:name "david"})', env, m)).toBeType(
          "{:name string}"
        );
      });
    });

    describe("Do blocks", () => {
      it("type is the type of the last form", () => {
        expect(typeOf("(do 1 2 3)")).toBeType("number");
      });
      it("constraint types properly", () => {
        expect(typeOf("(lambda (x) (print x) x)")).toBeType(
          "(-> ctx string (effect console <| α) string)"
        );
      });
    });

    describe("Recursion", () => {
      it("type is inferred for simple functions", () => {
        expect(
          typeOf(
            "f",
            undefined,
            `
(define f
  (lambda (n)
    (if (= n 0)
        1
        (* n (f (- n 1))))))`
          )
        ).toBeType("(-> ctx number (effect <| α) number)");
      });

      it("basic polymorphic function on lists should work", () => {
        const env = {
          variables: {
            "empty?": readType("(-> ctx [a] _ boolean)"),
            "+": readType("(-> ctx number number _ number)"),
            rest: readType("(-> ctx [a] (effect exp <| _) [a])")
          },
          types: {}
        };

        expect(
          typeOf(
            "f",
            env,
            `
(define f
  (lambda (l)
    (if (empty? l)
        0
        (+ 1 (f (rest l))))))
`
          )
        ).toBeType("(-> ctx [α] (effect exp <| β) number)");
      });
    });
  });

  describe("Effects", () => {
    it("should infer the effect with let bindings bounded to some monomorphic function call", () => {
      expect(
        typeOf(
          `
(lambda (f)
  (let {x (f)}
    x))
`
        )
      ).toBeType("(-> ctx (-> ctx (effect) (values α <| β)) γ α)");
    });
  });

  describe("Multiple Values", () => {
    it("should infer the primary type of a values form in an argument position", () => {
      expect(typeOf(`(+ 1 (values 2 3)))`)).toBeType("number");
      expect(typeOf(`(lambda (x) (values (values x x))))`)).toBeType(
        "(-> ctx α β α)"
      );
    });

    it("should infer the type of a function with multiple values", () => {
      expect(typeOf(`(lambda (x) (values x "foo"))`)).toBeType(
        "(-> ctx α β (values α string))"
      );
    });

    it("infer multiple values of a function call in tail-position", () => {
      expect(typeOf(`(lambda (f) (f))`)).toBeType(
        `(-> ctx (-> ctx α (values β <| γ)) α (values β <| γ))`
      );
    });

    it("infer type of multiple-value-bind", () => {
      const result = typeOf(
        `(multiple-value-bind (x y) (values "foo" 2) (pair x y))`
      );
      expect(result).toBeType(`(* string number)`);
    });

    it("infer the effect of a field selector", () => {
      expect(typeOf(`(lambda () ($get :x {:x (print "foo")}))`)).toBeType(
        `(-> ctx (effect console <| e) none)`
      );
    });
  });

  describe(`Context argument`, () => {
    it("should infer the type of the context argument automatically", () => {
      const result = typeOf(`(lambda (x) (+ *context* x))`);
      expect(result).toBeType(`(-> number number (effect <| e) number)`);
    });
  });

  describe("Regressions", () => {
    it("(the _ _) type annotations should keep the type annotation node in the AST", () => {
      const expr = readExpr("(the number 10)");
      const typedExpr = inferType(expr, emptyExternalEnv, undefined, false);
      expect(typedExpr).toHaveProperty(["node", "tag"], "type-annotation");
    });

    it("Annotations can state the same type for an expression with different variable names", () => {
      const env = {
        variables: { id: readType("(-> ctx a1 b1 a1)") },
        types: {}
      };
      expect(typeOf("(the (-> ctx a2 b2 a2) id)", env)).toBeType(
        "(-> ctx α β α)"
      );
    });

    it("User-specified type variables do not propagate to conflict with each other", () => {
      const env = { variables: { id: readType("(-> ctx a b a)") }, types: {} };
      expect(
        typeOf("(the (-> ctx c d c) (the (-> ctx a b a) id))", env)
      ).toBeType("(-> ctx α β α)");
    });
  });
});

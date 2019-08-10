import { moduleEnvironment } from "../src/compiler";
import { createSandbox, evaluate } from "../src/eval";
import { readSyntax } from "../src/index";
import { macroexpandSyntax } from "../src/index";
import { createModule } from "../src/module";
import * as S from "../src/syntax";
import { inferExpressionInModule } from "../src/infer";

function evaluateString(str: string): unknown {
  const env = moduleEnvironment(createModule(), {
    getOutputFile(name) {
      return name;
    }
  });
  const s = macroexpandSyntax(readSyntax(`(lambda () ${str})`));
  const sandbox = createSandbox(() => null);
  if (!S.isExpression(s)) {
    throw new Error(`Can't evaluate a non-expression!`);
  }
  const { typedExpression } = inferExpressionInModule(
    s,
    createModule(),
    undefined
  );

  const lambda: any = evaluate(typedExpression, env, sandbox);

  // We want to try to make evaluateString be synchronous most of the
  // time. So we won't use async/await here but just resolve the
  // promise to evaluate the wrapper function when necessary only.
  if (lambda instanceof Promise) {
    return lambda.then(fn => fn((x: unknown) => x, {}));
  } else {
    return lambda((x: unknown) => x, {});
  }
}

describe("Evaluation", () => {
  describe("Booleans", () => {
    it("should self-evaluate", async () => {
      expect(await evaluateString("true")).toBe(true);
      expect(await evaluateString("false")).toBe(false);
    });
  });

  describe("Numbers", () => {
    it("should self-evaluate", async () => {
      expect(await evaluateString("0")).toBe(0);
      expect(await evaluateString("1")).toBe(1);
      expect(await evaluateString("-1")).toBe(-1);
    });
  });

  describe("Strings", () => {
    it("should self-evaluate", async () => {
      expect(await evaluateString('""')).toBe("");
      expect(await evaluateString('"foo"')).toBe("foo");
      expect(await evaluateString('"a\\nb"')).toBe("a\nb");
    });
  });

  describe("Function calls", () => {
    it("should evaluate to the right value", async () => {
      expect(await evaluateString("(+ 1 2)")).toBe(3);
      expect(await evaluateString("(+ (+ 1 1) 2)")).toBe(4);
    });
  });

  describe("Lambda abstractions", () => {
    it("should be able to be called", async () => {
      expect(await evaluateString("((lambda (x y) y) 4 5)")).toBe(5);
    });

    it("should return records as objects", async () => {
      expect(await evaluateString("((lambda (x) {:x x}) 10)")).toEqual({
        x: 10
      });
    });

    it("should return the last expression of the body", async () => {
      expect(await evaluateString("((lambda (x) x 1) 10)")).toBe(1);
      expect(await evaluateString("((lambda (x) x {:a 1}) 10)")).toEqual({
        a: 1
      });
    });

    // Regression
    it("different argument names should not shadow", async () => {
      expect(
        await evaluateString(`
((lambda (x)
  ((lambda (y) x) 11))
 33)
`)
      ).toBe(33);
    });
  });

  describe("Let bindings", () => {
    it("should evaluate to the right value", async () => {
      expect(await evaluateString("(let {} 5)")).toBe(5);
      expect(await evaluateString("(let {x 5} x)")).toBe(5);
      expect(await evaluateString("(let {x 4 y 6} (+ x y))")).toBe(10);
      expect(
        await evaluateString(`
(let {const (lambda (x)
              (lambda (y) x))}
  (+ ((const 10) "foo")
     ((const 20) 42)))
`)
      ).toBe(30);
    });

    it("inner lets should shadow outer ones", async () => {
      expect(await evaluateString("(let {x 5} (let {x 1} x))")).toBe(1);
    });

    it("should shadow inline primitives", async () => {
      expect(await evaluateString("(let {+ 10} +)")).toBe(10);
    });
  });

  describe("lists", () => {
    it("basic list operations work", async () => {
      expect(await evaluateString("(empty? [])")).toBe(true);
      expect(await evaluateString("(not (empty? (cons 1 [])))")).toBe(true);
      // expect(await evaluateString("(first (cons 1 []))")).toBe(1);
      expect(await evaluateString("(rest (cons 1 []))")).toEqual([]);
    });
  });

  describe("conditionals", () => {
    it("simple conditionals evaluate correctly", async () => {
      expect(await evaluateString("(if true 1 2)")).toBe(1);
      expect(await evaluateString("(if false 1 2)")).toBe(2);
    });
  });

  describe("Primitives", () => {
    it("map", async () => {
      expect(
        await evaluateString("(map (lambda (x) (+ x x)) [1 2 3 4])")
      ).toEqual([2, 4, 6, 8]);
    });

    it("filter", async () => {
      expect(
        await evaluateString("(filter (lambda (x) (< 0 x)) [-2 -1 0 1 2])")
      ).toEqual([1, 2]);
    });

    it("fold", async () => {
      expect(await evaluateString("(fold + [1 2 3 4] 0)")).toEqual(10);
    });
  });

  describe("Records", () => {
    it("should construct records", async () => {
      expect(await evaluateString("{:x 2 :y 8}")).toEqual({ x: 2, y: 8 });
    });
    it("should access record fields", async () => {
      expect(await evaluateString("(:foo {:bar 3 :foo 5 :baz 2})")).toEqual(5);
    });
    it("should update records", async () => {
      expect(await evaluateString("{:x 2 | {:x 1}}")).toEqual({ x: 2 });
      expect(await evaluateString("{:x 3 | {:x 1 :y 2}}")).toEqual({
        x: 3,
        y: 2
      });
    });
  });

  describe("Do blocks", () => {
    it("should evaluate to the last form", async () => {
      expect(await evaluateString(`(do 1)`)).toBe(1);
      expect(await evaluateString(`(do 1 2)`)).toBe(2);
    });
  });

  describe("Multiple values", () => {
    it("uses the primary value by default", async () => {
      expect(await evaluateString(`(+ 1 (values 2 10))`)).toBe(3);
      expect(await evaluateString(`(+ (values 1) (values 2 10))`)).toBe(3);
    });

    it("multiple-value-bind can catch forms with a single value transparently", async () => {
      expect(await evaluateString(`(multiple-value-bind (x) 3 (+ x 1))`)).toBe(
        4
      );
    });

    it("multiple-value-bind can catch forms with a multiple values", async () => {
      expect(
        await evaluateString(`(multiple-value-bind (x y) (values 3 7) (+ x y))`)
      ).toBe(10);
    });
  });

  describe("Context argument", () => {
    it("should work across functions", async () => {
      expect(
        await evaluateString(`
(let {f (lambda () *context*)}
  (let {*context* 10}
  (f)))`)
      ).toBe(10);
    });
  });

  describe("Match and case", () => {
    it("should do basic pattern matching", async () => {
      expect(
        await evaluateString(`
(match (case :increase 10)
  ({:increase x} (+ x 1))
  ({:decrease x} (- x 1)))`)
      ).toBe(11);

      expect(
        await evaluateString(`
(match (case :decrease 10)
  ({:increase x} (+ x 1))
  ({:decrease x} (- x 1)))`)
      ).toBe(9);
    });
  });
});

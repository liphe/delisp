import { readSyntax } from "../src/index";
import { evaluate } from "../src/eval";
import { createModule } from "../src/module";
import { moduleEnvironment } from "../src/compiler";

function evaluateString(str: string): any {
  const env = moduleEnvironment(createModule());
  const s = readSyntax(str);
  return evaluate(s, env);
}

describe("Evaluation", () => {
  describe("Numbers", () => {
    it("should self-evaluate", () => {
      expect(evaluateString("0")).toBe(0);
      expect(evaluateString("1")).toBe(1);
      expect(evaluateString("-1")).toBe(-1);
    });
  });

  describe("Strings", () => {
    it("should self-evaluate", () => {
      expect(evaluateString('""')).toBe("");
      expect(evaluateString('"foo"')).toBe("foo");
      expect(evaluateString('"a\\nb"')).toBe("a\nb");
    });
  });

  describe("Function calls", () => {
    it("should evaluate to the right value", () => {
      expect(evaluateString("(+ 1 2)")).toBe(3);
      expect(evaluateString("(+ (+ 1 1) 2)")).toBe(4);
    });
  });

  describe("Lambda abstractions", () => {
    it("should be able to be called", () => {
      expect(evaluateString("((lambda (x y) y) 4 5)")).toBe(5);
    });

    // Regression
    it("different argument names should not shadow", () => {
      expect(
        evaluateString(`
((lambda (x)
  ((lambda (y) x) 11))
 33)
`)
      ).toBe(33);
    });
  });

  describe("Let bindings", () => {
    it("should evaluate to the right value", () => {
      expect(evaluateString("(let () 5)")).toBe(5);
      expect(evaluateString("(let ((x 5)) x)")).toBe(5);
      expect(evaluateString("(let ((x 5) (y 5)) (+ x y))")).toBe(10);
      expect(
        evaluateString(`
(let ((const (lambda (x)
               (lambda (y) x))))
  (+ ((const 10) "foo")
     ((const 20) 42)))
`)
      ).toBe(30);
    });

    it("inner lets should shadow outer ones", () => {
      expect(evaluateString("(let ((x 5)) (let ((x 1)) x))")).toBe(1);
    });
  });

  describe("lists", () => {
    expect(evaluateString("(empty? nil)")).toBe(true);
    expect(evaluateString("(not (empty? (cons 1 nil)))")).toBe(true);
    expect(evaluateString("(first (cons 1 nil))")).toBe(1);
    expect(evaluateString("(rest (cons 1 nil))")).toEqual([]);
  });

  describe("conditionals", () => {
    expect(evaluateString("(if true 1 2)")).toBe(1);
    expect(evaluateString("(if false 1 2)")).toBe(2);
  });

  describe("Primitives", () => {
    it("map", () => {
      expect(evaluateString("(map (lambda (x) (+ x x)) [1 2 3 4])")).toEqual([
        2,
        4,
        6,
        8
      ]);
    });

    it("filter", () => {
      expect(
        evaluateString("(filter (lambda (x) (< 0 x)) [-2 -1 0 1 2])")
      ).toEqual([1, 2]);
    });

    it("fold", () => {
      expect(
        evaluateString("(fold + [1 2 3 4] 0)")
      ).toEqual(10);
    });
  });
});

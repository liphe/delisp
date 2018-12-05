import { readSyntax } from "../src/index";
import { evaluate } from "../src/eval";

function evaluateString(str: string): any {
  return evaluate(readSyntax(str));
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
  });
});

import { readFromString } from "../src/reader";
import { convert } from "../src/convert";
import { compileToString } from "../src/compiler";

describe("Compiler", () => {
  describe("Error messages", () => {
    function compileError(str: string): string {
      let result: string | undefined;
      try {
        const sexpr = readFromString(str);
        const syntax = convert(sexpr);
        compileToString(syntax);
      } catch (err) {
        result = err.message;
      }
      if (result) {
        return result;
      } else {
        throw new Error(`FATAL: EXPRESSION DID NOT FAIL TO COMPILE.`);
      }
    }

    it("generate nice error message for invalid lambda expressions", () => {
      expect(compileError("(lambda)")).toMatchSnapshot();
      expect(compileError("(lambda 7)")).toMatchSnapshot();
      expect(compileError("(lambda 7 5)")).toMatchSnapshot();
      expect(compileError("(lambda (7) x)")).toMatchSnapshot();
      expect(compileError("(lambda (x 7) x)")).toMatchSnapshot();
    });

    it("generate nice error message for invalid let expressions", () => {
      expect(compileError("(let)")).toMatchSnapshot();
      expect(compileError("(let x 5)")).toMatchSnapshot();
      expect(compileError("(let (x) x)")).toMatchSnapshot();
      expect(compileError("(let ((5 5)) x)")).toMatchSnapshot();
      expect(compileError("(let ((x)) x)")).toMatchSnapshot();
    });

    it("generate nice error message for invalid definitions", () => {
      expect(compileError("(define)")).toMatchSnapshot();
      expect(compileError("(define 5)")).toMatchSnapshot();
      expect(compileError("(define x)")).toMatchSnapshot();
      expect(compileError("(define 4 2)")).toMatchSnapshot();
    });

    it("generate nice error message for conditionals", () => {
      expect(compileError("(if)")).toMatchSnapshot();
      expect(compileError("(if 5)")).toMatchSnapshot();
      expect(compileError("(if x 2)")).toMatchSnapshot();
      expect(compileError("(if x 2 3 0)")).toMatchSnapshot();
    });
  });
});

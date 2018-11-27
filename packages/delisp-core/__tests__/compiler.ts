import { readFromString } from "../src/reader";
import { compileToString } from "../src/compiler";

describe("Compiler", () => {
  describe("Error messages", () => {
    function compileError(str: string): string {
      try {
        const ast = readFromString(str);
        compileToString(ast);
        throw new Error(`FATAL: EXPRESSION DID NOT FAIL TO COMPILE.`);
      } catch (err) {
        return err.message;
      }
    }

    it("generate nice error message for invalid lambda expressions", () => {
      expect(compileError("(lambda)")).toMatchSnapshot();
      expect(compileError("(lambda 7)")).toMatchSnapshot();
      expect(compileError("(lambda 7 5)")).toMatchSnapshot();
      expect(compileError("(lambda (7) x)")).toMatchSnapshot();
      expect(compileError("(lambda (x 7) x)")).toMatchSnapshot();
    });

    it("generate nice error message for invalid definitions", () => {
      expect(compileError("(define)")).toMatchSnapshot();
      expect(compileError("(define 5)")).toMatchSnapshot();
      expect(compileError("(define x)")).toMatchSnapshot();
      expect(compileError("(define 4 2)")).toMatchSnapshot();
    });
  });
});

import { convert, collectConvertErrors } from "../src/convert";
import { readFromString } from "../src/reader";

describe("Convert", () => {
  describe("Error messages", () => {
    function compileError(str: string): string {
      const sexpr = readFromString(str);
      const syntax = convert(sexpr);
      const errors = collectConvertErrors(syntax);
      if (errors.length === 0) {
        throw new Error(`FATAL: EXPRESSION ${str} DID NOT FAIL TO COMPILE.`);
      }
      return errors.join("\n\n");
    }

    it("generate a nice error for some basic invalid syntax", () => {
      expect(compileError("()")).toMatchSnapshot();
    });

    it("generate nice error message for invalid lambda expressions", () => {
      expect(compileError("(lambda)")).toMatchSnapshot();
      expect(compileError("(lambda 7)")).toMatchSnapshot();
      expect(compileError("(lambda 7 5)")).toMatchSnapshot();
      expect(compileError("(lambda (7) x)")).toMatchSnapshot();
      expect(compileError("(lambda (x 7) x)")).toMatchSnapshot();
      expect(compileError("(lambda (x x) x)")).toMatchSnapshot();
    });

    it("generate nice error message for invalid let expressions", () => {
      expect(compileError("(let)")).toMatchSnapshot();
      expect(compileError("(let x 5)")).toMatchSnapshot();
      expect(compileError("(let (x 5) x)")).toMatchSnapshot();
    });

    it.skip("generate nice error message a let expression with odd numbrer of elements in the bindings", () => {
      // Those two tests cases have been commented out because the
      // error is coming from the reader, not the converter, so they
      // are not handled very nicely now.
      expect(compileError("(let {x} x)")).toMatchSnapshot();
      expect(compileError("(let {a b c} x)")).toMatchSnapshot();
    });

    it.skip("generate nice error message for invalid let expressions with duplicated variable names", () => {
      expect(compileError("(let {x 10 x 20} x)")).toMatchSnapshot();
    });

    it("generate nice error message for invalid definitions", () => {
      expect(compileError("(define)")).toMatchSnapshot();
      expect(compileError("(define 5)")).toMatchSnapshot();
      expect(compileError("(define x)")).toMatchSnapshot();
      expect(compileError("(define 4 2)")).toMatchSnapshot();
      expect(compileError("(define x 10 23)")).toMatchSnapshot();
    });

    it("generate nice error message for conditionals", () => {
      expect(compileError("(if)")).toMatchSnapshot();
      expect(compileError("(if 5)")).toMatchSnapshot();
      expect(compileError("(if x 2)")).toMatchSnapshot();
      expect(compileError("(if x 2 3 0)")).toMatchSnapshot();
    });

    it("generate nice error message for invalid records", () => {
      expect(compileError("{:x 10 | y :z 20}")).toMatchSnapshot();
    });

    it("generate nice error message for records with duplicated labels", () => {
      expect(compileError("{:x 10 :x 20}")).toMatchSnapshot();
    });

    it("generate nice error message for invalid type annotations", () => {
      expect(compileError("(the)")).toMatchSnapshot();
      expect(compileError("(the 3)")).toMatchSnapshot();
      expect(compileError("(the ID)")).toMatchSnapshot();
      expect(compileError("(the 3 3)")).toMatchSnapshot();
      expect(compileError("(the ID 3 3)")).toMatchSnapshot();
    });

    it("generate nice error message for bad type declarations", () => {
      expect(compileError("(type)")).toMatchSnapshot();
      expect(compileError("(type a)")).toMatchSnapshot();
      expect(compileError("(type A)")).toMatchSnapshot();
      expect(compileError("(type A 3)")).toMatchSnapshot();
      expect(compileError("(type a {})")).toMatchSnapshot();
      expect(compileError("(type ID {} 10)")).toMatchSnapshot();
      expect(compileError("(type 3 5)")).toMatchSnapshot();
      expect(compileError("(type ID (-> a a))")).toMatchSnapshot();
    });

    it("generate nice error messages for invalid exports", () => {
      expect(compileError("(export)")).toMatchSnapshot();
      expect(compileError("(export 1)")).toMatchSnapshot();
      expect(compileError("(export (+ 1 2))")).toMatchSnapshot();
      expect(compileError("(export 1 2 3)")).toMatchSnapshot();
    });

    it("generate nice errors for do-blocks", () => {
      expect(compileError("(do)")).toMatchSnapshot();
    });

    it("generaten nice errors for multiple-value-bind form", () => {
      expect(compileError("(multiple-value-bind)")).toMatchSnapshot();
      expect(compileError("(multiple-value-bind x)")).toMatchSnapshot();
      expect(compileError("(multiple-value-bind x y)")).toMatchSnapshot();
      expect(compileError("(multiple-value-bind (x) y)")).toMatchSnapshot();
    });
  });
});

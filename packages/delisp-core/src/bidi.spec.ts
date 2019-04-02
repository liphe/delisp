import { Expression } from "./syntax";
import { Type } from "./types";

import { readFromString } from "./reader";
import { convertExpr } from "./convert";
import { convert as convertType } from "./convert-type";

import { infer, check, Environment } from "./bidi";

function expr(str: string): Expression {
  return convertExpr(readFromString(str));
}

function type(str: string): Type {
  return convertType(readFromString(str));
}

function typeError(str: string, env: Environment = {}) {
  try {
    infer(expr(str), env);
  } catch (err) {
    return err.message;
  }
  throw new Error(`Did not fail`);
}

const env = {
  true: type("boolean"),
  false: type("boolean"),
  "+": type("(-> number number number)")
};

describe("Bidirectional typing", () => {
  test("number types are infered", () => {
    expect(infer(expr("23"), {})).toEqual(type("number"));
  });

  test("number types are checked", () => {
    expect(() => check(expr("23"), type("number"), {})).not.toThrow();
  });

  test("function types are checked", () => {
    expect(() =>
      infer(expr(`(the (-> number number) (lambda (x) x))`), {})
    ).not.toThrow();
  });

  test("function call types are inferred", () => {
    expect(() => infer(expr(`(+ 2 3)`), env)).not.toThrow();
  });

  test("conditionals are infered", () => {
    expect(() =>
      check(expr("(if true 1 2)"), type("number"), env)
    ).not.toThrow();
  });

  describe("Error messages", () => {
    test("annotating a string as a number", () => {
      expect(typeError(`(the number "foo")`)).toMatchSnapshot();
    });

    test("wrong number of declared arguments", () => {
      expect(
        typeError(`(the (-> number number number) (lambda (x) x))`)
      ).toMatchSnapshot();
    });

    test("wrong argument", () => {
      expect(typeError(`(+ 2 "foo")`, env)).toMatchSnapshot();
    });
    test("ambiguous conditional", () => {
      expect(typeError(`(if true 1 "foo")`, env)).toMatchSnapshot();
    });
    test("non-boolean conditional", () => {
      expect(typeError(`(if 1 "abc" "foo")`, env)).toMatchSnapshot();
    });
  });
});

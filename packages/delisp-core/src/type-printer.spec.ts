import {
  tFn,
  tMultiValuedFunction,
  tValues,
  tEffect,
  tCases,
  tVar,
  tVoid
} from "./types";
import { printType } from "./type-printer";

describe("Type printer", () => {
  test("effect types are printed properly", () => {
    expect(printType(tEffect(["console", "async"]), false)).toBe(
      "(effect console async)"
    );
  });

  test("open effect types are printed properly", () => {
    expect(printType(tEffect(["console", "async"], tVar("a")), false)).toBe(
      "(effect console async | a)"
    );
  });

  test("cases type are printed correctly", () => {
    expect(
      printType(
        tCases(
          [{ label: ":a", type: tVar("a") }, { label: ":b", type: tVoid }],
          tVar("c")
        ),
        false
      )
    ).toBe("(cases (:a a) :b c)");
  });

  test("print function types returning a single value", () => {
    expect(printType(tFn([], tEffect([]), tVar("a")), false)).toBe(
      "(-> (effect) a)"
    );
    expect(
      printType(
        tMultiValuedFunction([], tEffect([]), tValues([tVar("a")])),
        false
      )
    ).toBe("(-> (effect) a)");
  });

  test("print function types returning multiple values", () => {
    expect(
      printType(
        tMultiValuedFunction([], tEffect([]), tValues([tVar("a"), tVar("a")])),
        false
      )
    ).toBe("(-> (effect) (values a a))");
  });
});

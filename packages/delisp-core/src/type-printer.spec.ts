import { printType } from "./type-printer";
import {
  cases,
  effect,
  fn,
  multiValuedFunction,
  values,
  tVar,
  tVoid
} from "./types";

describe("Type printer", () => {
  test("effect types are printed properly", () => {
    expect(printType(effect(["console", "async"]), false)).toBe(
      "(effect console async)"
    );
  });

  test("open effect types are printed properly", () => {
    expect(printType(effect(["console", "async"], tVar("a")), false)).toBe(
      "(effect console async | a)"
    );
  });

  test("cases type are printed correctly", () => {
    expect(
      printType(
        cases(
          [{ label: ":a", type: tVar("a") }, { label: ":b", type: tVoid }],
          tVar("c")
        ),
        false
      )
    ).toBe("(cases (:a a) :b c)");
  });

  test("print function types returning a single value", () => {
    expect(printType(fn([], effect([]), tVar("a")), false)).toBe(
      "(-> (effect) a)"
    );
    expect(
      printType(multiValuedFunction([], effect([]), values([tVar("a")])), false)
    ).toBe("(-> (effect) a)");
  });

  test("print function types returning multiple values", () => {
    expect(
      printType(
        multiValuedFunction([], effect([]), values([tVar("a"), tVar("a")])),
        false
      )
    ).toBe("(-> (effect) (values a a))");
  });
});

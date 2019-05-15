import { tEffect, tVar } from "./types";
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
});

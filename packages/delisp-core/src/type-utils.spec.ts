import { readType } from "./type-convert";
import { printType } from "./type-printer";
import { openFunctionEffect } from "./type-utils";

describe("Type utils", () => {
  describe("openFunctionEffect", () => {
    function openType(spec: string): string {
      return printType(openFunctionEffect(readType(spec, false).mono));
    }

    test("should not change the constant types", () => {
      expect(openType("number")).toBe("number");
      expect(openType("string")).toBe("string");
    });

    test("should not change the type of open functions", () => {
      expect(openType("(-> α string (effect console <| β) none)")).toBe(
        "(-> α string (effect console <| β) none)"
      );
    });

    it("should open the effect of a effect-closed function", () => {
      expect(openType("(-> α string (effect console) none)")).toBe(
        "(-> α string (effect console <| β) none)"
      );
    });
  });
});

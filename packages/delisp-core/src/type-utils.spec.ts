import * as T from "./types";
import { readType } from "./type-convert";
import { printType } from "./type-printer";
import {
  openFunctionEffect,
  closeFunctionEffect,
  instantiateTypeSchemaForVariable,
} from "./type-utils";

describe("Type utils", () => {
  describe("openFunctionEffect", () => {
    function openType(spec: string): string {
      return printType(openFunctionEffect(readType(spec).mono));
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

  describe("closeFunctionEffect", () => {
    function closeType(spec: string): string {
      return printType(closeFunctionEffect(readType(spec)).mono);
    }

    test("should not change the constant types", () => {
      expect(closeType("number")).toBe("number");
      expect(closeType("string")).toBe("string");
    });

    test("should not change the type of closed functions", () => {
      expect(closeType("(-> α string (effect console) none)")).toBe(
        "(-> α string (effect console) none)"
      );
    });

    it("should close the effect of a open effect function", () => {
      expect(closeType("(-> α string (effect console <| e) none)")).toBe(
        "(-> α string (effect console) none)"
      );
    });

    it("should NOT close the effect of higher order functions with polymorphic effects", () => {
      expect(closeType("(-> α (-> α β none) (effect console <| β) none)")).toBe(
        "(-> α (-> α β none) (effect console <| β) none)"
      );
    });

    it("should not closed over an effect that is not a generalized variable of the type schema", () => {
      const polytype = instantiateTypeSchemaForVariable(
        readType("(-> α (effect console <| β) none)"),
        T.var("β"),
        T.var("eff")
      );
      expect(printType(closeFunctionEffect(polytype).mono)).toBe(
        "(-> α (effect console <| β) none)"
      );
    });
  });
});

import {
  tFn,
  tApp,
  tNumber,
  tRecord,
  tUserDefined,
  tVar,
  tVector
} from "../src/types";
import { unify } from "../src/unify";

describe("Unification", () => {
  it("should perform an occur check", () => {
    const t1 = tVar("t1");
    const t2 = tVector(t1);
    const result = unify(t1, t2, {});
    expect(result.tag).toBe("unify-occur-check-error");
  });

  describe("Application", () => {
    it("should catch function arity mismatches", () => {
      const t1 = tFn([tNumber, tNumber], tVar("_"), tNumber);
      const t2 = tFn([tNumber], tVar("_"), tNumber);
      const result = unify(t1, t2, {});
      expect(result.tag).toBe("unify-missing-value-error");
    });
    it("should catch operator mismatches", () => {
      const t1 = tVector(tNumber);
      const t2 = tFn([], tVar("_"), tNumber);
      const result = unify(t1, t2, {});
      expect(result.tag).toBe("unify-mismatch-error");
    });
    it("should unify the operator", () => {
      const t1 = tVar("r");
      const t2 = tVar("r");
      const result = unify(tApp(t1), tApp(t2), {});
      expect(result.tag).toBe("unify-success");
    });
  });

  describe("Records", () => {
    it("with different head and same tail should not unify", () => {
      const r = tVar("r");
      const t1 = tRecord([{ label: ":x", type: tNumber }], r);
      const t2 = tRecord([{ label: ":y", type: tNumber }], r);
      const result = unify(t1, t2, {});
      expect(result.tag).toBe("unify-mismatch-error");
    });

    it("with multiple different head and same tail should not unify", () => {
      const r = tVar("r");
      const t1 = tRecord([{ label: ":x", type: tNumber }], r);
      const t2 = tRecord(
        [{ label: "z", type: tNumber }, { label: ":y", type: tNumber }],
        r
      );
      const result = unify(t1, t2, {});
      expect(result.tag).toBe("unify-mismatch-error");
    });

    it("closed rows with different labels dont unify", () => {
      const t1 = tRecord([{ label: ":x", type: tNumber }]);
      const t2 = tRecord([{ label: ":z", type: tNumber }]);
      const result = unify(t1, t2, {});
      expect(result.tag).toBe("unify-mismatch-error");
    });
  });

  describe("User defined types", () => {
    it("should unify with themselves", () => {
      const t1 = tUserDefined("A");
      const t2 = tUserDefined("A");
      const result = unify(t1, t2, {});
      expect(result.tag).toBe("unify-success");
    });

    it("should not unify with its definition", () => {
      const t1 = tNumber;
      const t2 = tUserDefined("A");
      const result = unify(t1, t2, { a: tNumber });
      expect(result.tag).toBe("unify-mismatch-error");
    });
  });
});

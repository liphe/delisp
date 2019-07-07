import { generateUniqueTVar } from "../src/type-generate";
import {
  app,
  fn,
  number,
  record,
  userDefined,
  tVar,
  vector
} from "../src/types";
import { unify } from "../src/unify";

describe("Unification", () => {
  it("should perform an occur check", () => {
    const t1 = tVar("t1");
    const t2 = vector(t1);
    const result = unify(t1, t2, {});
    expect(result.tag).toBe("unify-occur-check-error");
  });

  describe("Application", () => {
    it("should catch function arity mismatches", () => {
      const t1 = fn([number, number], tVar("_"), number);
      const t2 = fn([number], tVar("_"), number);
      const result = unify(t1, t2, {});
      expect(result.tag).toBe("unify-mismatch-error");
    });
    it("should catch operator mismatches", () => {
      const t1 = vector(number);
      const t2 = fn([], tVar("_"), number);
      const result = unify(t1, t2, {});
      expect(result.tag).toBe("unify-mismatch-error");
    });
    it("should unify the operator", () => {
      const t1 = tVar("r");
      const t2 = tVar("r");
      const result = unify(app(t1), app(t2), {});
      expect(result.tag).toBe("unify-success");
    });
  });

  describe("Records", () => {
    it("with different head and same tail should not unify", () => {
      const r = tVar("r");
      const t1 = record([{ label: ":x", type: number }], r);
      const t2 = record([{ label: ":y", type: number }], r);
      const result = unify(t1, t2, {});
      expect(result.tag).toBe("unify-mismatch-error");
    });

    it("with multiple different head and same tail should not unify", () => {
      const r = tVar("r");
      const t1 = record([{ label: ":x", type: number }], r);
      const t2 = record(
        [{ label: "z", type: number }, { label: ":y", type: number }],
        r
      );
      const result = unify(t1, t2, {});
      expect(result.tag).toBe("unify-mismatch-error");
    });

    it("closed rows with different labels dont unify", () => {
      const t1 = record([{ label: ":x", type: number }]);
      const t2 = record([{ label: ":z", type: number }]);
      const result = unify(t1, t2, {});
      expect(result.tag).toBe("unify-mismatch-error");
    });

    it("should unify records open multiple times", () => {
      const r1 = record([{ label: ":x", type: number }], generateUniqueTVar());
      const r2 = record([{ label: ":x", type: number }]);
      const t1 = fn([r1], generateUniqueTVar(), r1);
      const t2 = fn([r2], generateUniqueTVar(), r2);
      const result = unify(t1, t2, {});
      expect(result.tag).toBe("unify-success");
    });
  });

  describe("User defined types", () => {
    it("should unify with themselves", () => {
      const t1 = userDefined("A");
      const t2 = userDefined("A");
      const result = unify(t1, t2, {});
      expect(result.tag).toBe("unify-success");
    });

    it("should not unify with its definition", () => {
      const t1 = number;
      const t2 = userDefined("A");
      const result = unify(t1, t2, { a: number });
      expect(result.tag).toBe("unify-mismatch-error");
    });
  });
});

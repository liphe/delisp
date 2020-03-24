import { generateUniqueTVar } from "../src/type-generate";
import * as T from "../src/types";
import { unify } from "../src/type-unify";

describe("Unification", () => {
  it("should perform an occur check", () => {
    const t1 = T.var("t1");
    const t2 = T.vector(t1);
    const result = unify(t1, t2, {});
    expect(result.tag).toBe("unify-occur-check-error");
  });

  describe("Application", () => {
    it("should catch function arity mismatches", () => {
      const t1 = T.fn([T.number, T.number], T.var("_"), T.number);
      const t2 = T.fn([T.number], T.var("_"), T.number);
      const result = unify(t1, t2, {});
      expect(result.tag).toBe("unify-mismatch-error");
    });
    it("should catch operator mismatches", () => {
      const t1 = T.vector(T.number);
      const t2 = T.fn([], T.var("_"), T.number);
      const result = unify(t1, t2, {});
      expect(result.tag).toBe("unify-mismatch-error");
    });
    it("should unify the operator", () => {
      const t1 = T.var("r");
      const t2 = T.var("r");
      const result = unify(T.app(t1), T.app(t2), {});
      expect(result.tag).toBe("unify-success");
    });
  });

  describe("Records", () => {
    it("with different head and same tail should not unify", () => {
      const r = T.var("r");
      const t1 = T.record([{ label: ":x", type: T.number }], r);
      const t2 = T.record([{ label: ":y", type: T.number }], r);
      const result = unify(t1, t2, {});
      expect(result.tag).toBe("unify-mismatch-error");
    });

    it("with multiple different head and same tail should not unify", () => {
      const r = T.var("r");
      const t1 = T.record([{ label: ":x", type: T.number }], r);
      const t2 = T.record(
        [
          { label: "z", type: T.number },
          { label: ":y", type: T.number },
        ],
        r
      );
      const result = unify(t1, t2, {});
      expect(result.tag).toBe("unify-mismatch-error");
    });

    it("closed rows with different labels dont unify", () => {
      const t1 = T.record([{ label: ":x", type: T.number }]);
      const t2 = T.record([{ label: ":z", type: T.number }]);
      const result = unify(t1, t2, {});
      expect(result.tag).toBe("unify-mismatch-error");
    });

    it("should unify records open multiple times", () => {
      const r1 = T.record(
        [{ label: ":x", type: T.number }],
        generateUniqueTVar()
      );
      const r2 = T.record([{ label: ":x", type: T.number }]);
      const t1 = T.fn([r1], generateUniqueTVar(), r1);
      const t2 = T.fn([r2], generateUniqueTVar(), r2);
      const result = unify(t1, t2, {});
      expect(result.tag).toBe("unify-success");
    });
  });

  describe("User defined types", () => {
    it("should unify with themselves", () => {
      const t1 = T.userDefined("A");
      const t2 = T.userDefined("A");
      const result = unify(t1, t2, {});
      expect(result.tag).toBe("unify-success");
    });

    it("should not unify with its definition", () => {
      const t1 = T.number;
      const t2 = T.userDefined("A");
      const result = unify(t1, t2, { a: T.number });
      expect(result.tag).toBe("unify-mismatch-error");
    });
  });
});

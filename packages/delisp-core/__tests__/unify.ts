import { tNumber, tVar, tVector, tRecord } from "../src/types";
import { unify } from "../src/unify";

describe("Unification", () => {
  it("should perform an occur check", () => {
    const t1 = tVar("t1");
    const t2 = tVector(t1);
    const result = unify(t1, t2);
    expect(result.type).toBe("unify-occur-check-error");
  });

  describe("Records", () => {
    it("with different head and same tail should not unify", () => {
      const r = tVar("r");
      const t1 = tRecord([{ label: "x", type: tNumber }], r);
      const t2 = tRecord([{ label: "y", type: tNumber }], r);
      const result = unify(t1, t2);
      expect(result.type).toBe("unify-mismatch-error");
    });

    it("with multiple different head and same tail should not unify", () => {
      const r = tVar("r");
      const t1 = tRecord([{ label: "x", type: tNumber }], r);
      const t2 = tRecord(
        [{ label: "z", type: tNumber }, { label: "y", type: tNumber }],
        r
      );
      const result = unify(t1, t2);
      expect(result.type).toBe("unify-mismatch-error");
    });
  });
});

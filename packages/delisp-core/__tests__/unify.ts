import { tVar, tVector } from "../src/types";
import { unify } from "../src/unify";

describe("Unification", () => {
  it("should perform an occur check", () => {
    const t1 = tVar("t1");
    const t2 = tVector(t1);
    const result = unify(t1, t2);
    expect(result.type).toBe("unify-occur-check-error");
  });
});

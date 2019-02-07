import { Monotype } from "../src/types";
import { unify } from "../src/unify";

describe("Unification", () => {
  it("should perform an occur check", () => {
    const t1: Monotype = {
      type: "type-variable",
      name: "t1"
    };
    const t2: Monotype = {
      type: "application",
      op: "list",
      args: [t1]
    };

    const result = unify(t1, t2);

    expect(result.type).toBe("unify-occur-check-error");
  });
});

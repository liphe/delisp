import { Expression, Typed } from "./syntax";
import { applySubstitution, Substitution } from "./type-utils";
import { transformRecurExpr } from "./syntax-utils";

export function applySubstitutionToExpr(
  s: Expression<Typed>,
  env: Substitution
): Expression<Typed> {
  return transformRecurExpr(s, expr => ({
    ...expr,
    info: {
      ...expr.info,
      type: applySubstitution(expr.info.type, env),
      effect: applySubstitution(expr.info.effect, env)
    }
  }));
}

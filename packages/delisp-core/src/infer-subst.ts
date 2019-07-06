import { Expression, Typed } from "./syntax";
import { transformRecurExpr } from "./syntax-utils";
import { applySubstitution, Substitution } from "./type-utils";

export function applySubstitutionToExpr(
  s: Expression<Typed>,
  env: Substitution
): Expression<Typed> {
  return transformRecurExpr(s, expr => ({
    ...expr,
    info: new Typed({
      expressionType: applySubstitution(expr.info.expressionType, env),
      resultingType:
        expr.info._resultingType &&
        applySubstitution(expr.info._resultingType, env),
      effect: applySubstitution(expr.info.effect, env)
    })
  }));
}

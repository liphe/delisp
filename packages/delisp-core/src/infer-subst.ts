import { assertNever, InvariantViolation } from "./invariant";
import * as S from "./syntax";
import { transformRecurExpr } from "./syntax-utils";
import { applySubstitution, Substitution } from "./type-utils";

export function applyTypeSubstitutionToVariable(
  s: S.SVariableReference<S.Typed>,
  env: Substitution
): S.SVariableReference<S.Typed> {
  const result = applySubstitutionToExpr(s, env);
  if (result.node.tag !== "variable-reference") {
    throw new InvariantViolation(
      `Replacing types to a syntax variable should still be syntax variable!`
    );
  }
  return { ...s, node: result.node };
}

export function applySubstitutionToExpr(
  s: S.Expression<S.Typed>,
  env: Substitution
): S.Expression<S.Typed> {
  return transformRecurExpr(s, expr => ({
    ...expr,
    info: new S.Typed({
      expressionType: applySubstitution(expr.info.expressionType, env),
      resultingType:
        expr.info._resultingType &&
        applySubstitution(expr.info._resultingType, env),
      effect: applySubstitution(expr.info.effect, env)
    })
  }));
}

export function applySubstitutionToSyntax(
  s: S.Syntax<S.Typed>,
  env: Substitution
): S.Syntax<S.Typed> {
  if (S.isExpression(s)) {
    return applySubstitutionToExpr(s, env);
  } else if (s.node.tag === "definition") {
    return {
      ...s,
      node: {
        ...s.node,
        value: applySubstitutionToExpr(s.node.value, env)
      }
    };
  } else if (s.node.tag === "export") {
    return s;
  } else if (s.node.tag === "type-alias") {
    return s;
  } else if (s.node.tag === "import") {
    return s;
  } else {
    return assertNever(s.node);
  }
}

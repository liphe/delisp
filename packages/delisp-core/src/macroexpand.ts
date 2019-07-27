import { assertNever } from "./invariant";
import * as S from "./syntax";
import { Location } from "./input";
import { ASExprSymbol } from "./sexpr";
import { sexpr } from "./sexpr-tag";
import { convertExpr, WithErrors } from "./syntax-convert";
import { mapExpr } from "./syntax-utils";

function macroexpandLabel(
  name: string,
  location: Location
): S.Expression<WithErrors> {
  const key: ASExprSymbol = {
    tag: "symbol",
    name,
    location
  };
  return convertExpr(sexpr`
(lambda (container)
  (values ($get ${key} container)
          (lambda (new-value)
            {${key} new-value | container})))
`);
}

/** Run a single macroexpansion step. */
export function macroexpandExpressionStep(
  expr: S.Expression<WithErrors>
): [S.Expression<WithErrors>, boolean] {
  if (expr.node.tag === "variable-reference") {
    const name = expr.node.name;
    if (name.startsWith(":")) {
      return [macroexpandLabel(expr.node.name, expr.location!), true];
    } else {
      return [expr, false];
    }
  } else {
    return [expr, false];
  }
}

/** Macroexpand fully an expression. */
export function macroexpandExpression(
  expr: S.Expression<WithErrors>
): S.Expression<WithErrors> {
  // Note that we do not want (necessarily) to macroexpand its
  // subforms. We just expand the toplevel form, and continue with the
  // result of this one!
  const [expandedExpr, expanded] = macroexpandExpressionStep(expr);
  if (expanded) {
    return macroexpandExpression(expandedExpr);
  } else {
    // Only after the top expression can't be expanded anymore, we
    // proceed to macroexpand the subexpressions.
    return mapExpr(expandedExpr, e => macroexpandExpression(e));
  }
}

export function macroexpandSyntax(
  syntax: S.Syntax<WithErrors, WithErrors>
): S.Syntax<WithErrors, WithErrors> {
  if (S.isExpression(syntax)) {
    return macroexpandExpression(syntax);
  } else if (S.isDefinition(syntax)) {
    return {
      node: {
        tag: "definition",
        variable: syntax.node.variable,
        value: macroexpandExpression(syntax.node.value)
      },
      info: {
        errors: []
      }
    };
  } else if (
    S.isExport(syntax) ||
    S.isImport(syntax) ||
    S.isTypeAlias(syntax)
  ) {
    return syntax;
  } else {
    return assertNever(syntax);
  }
}

export function macroexpandModule(
  m: S.Module<WithErrors, WithErrors>
): S.Module<WithErrors, WithErrors> {
  return {
    tag: "module",
    body: m.body.map(macroexpandSyntax)
  };
}

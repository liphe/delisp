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

function macroexpandFuncall(
  funcall: S.SFunctionCall<WithErrors>
): S.Expression<WithErrors> {
  return {
    ...funcall,
    node: {
      tag: "function-call",
      fn: funcall.node.fn,
      arguments: [convertExpr(sexpr`*context*`), ...funcall.node.arguments]
    }
  };
}

function macroexpandLambda(
  lambda: S.SFunction<WithErrors>
): S.Expression<WithErrors> {
  const { lambdaList } = lambda.node;
  return {
    ...lambda,
    node: {
      tag: "function",
      lambdaList: {
        tag: "function-lambda-list",
        positionalArguments: [
          { tag: "identifier", name: "*context*", location: lambda.location },
          ...lambdaList.positionalArguments
        ],
        location: lambdaList.location
      },
      body: lambda.node.body
    }
  };
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
  } else if (expr.node.tag === "function") {
    return [macroexpandLambda({ ...expr, node: expr.node }), false];
  } else if (expr.node.tag === "function-call") {
    return [macroexpandFuncall({ ...expr, node: expr.node }), false];
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
  const [expandedExpr, expandMore] = macroexpandExpressionStep(expr);
  if (expandMore) {
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
      },
      location: syntax.location
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

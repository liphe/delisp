import { moduleDefinitions } from "./module";
import { Module, Syntax, Expression, isExpression } from "./syntax";
import { mapExpr } from "./syntax-utils";

export interface Scoped {
  variables: string[];
}

type Environment = string[];

export function resolveNames<I>(
  expr: Expression<I>,
  env: Environment
): Expression<I & Scoped> {
  switch (expr.node.tag) {
    case "function": {
      const args = expr.node.lambdaList.positionalArguments.map((a) => a.name);
      const newenv = [...env, ...args];
      return {
        ...expr,
        node: {
          ...expr.node,
          body: expr.node.body.map((e) => resolveNames(e, newenv)),
        },
        info: {
          ...expr.info,
          variables: env,
        },
      };
    }

    case "let-bindings": {
      const vars = expr.node.bindings.map((b) => b.variable.name);
      const newenv = [...env, ...vars];
      return {
        ...expr,
        node: {
          ...expr.node,
          bindings: expr.node.bindings.map((b) => {
            return {
              ...b,
              value: resolveNames(b.value, env),
            };
          }),

          body: expr.node.body.map((e) => resolveNames(e, newenv)),
        },
        info: {
          ...expr.info,
          variables: env,
        },
      };
    }

    // no new names introduced here
    default: {
      const resolvedExpr = mapExpr(expr, (e) => resolveNames(e, env));
      return {
        ...resolvedExpr,
        info: {
          ...resolvedExpr.info,
          variables: env,
        },
      };
    }
  }
}

function resolveNamesInSynstax<I>(
  syntax: Syntax<I>,
  env: Environment
): Syntax<I & Scoped> {
  if (isExpression(syntax)) {
    return resolveNames(syntax, env);
  } else {
    switch (syntax.node.tag) {
      case "definition":
        return {
          ...syntax,
          node: {
            ...syntax.node,
            value: resolveNames(syntax.node.value, env),
          },
          info: {
            ...syntax.info,
            variables: env,
          },
        };
      default:
        return {
          ...syntax,
          info: {
            ...syntax.info,
            variables: env,
          },
        };
    }
  }
}

export function resolveNamesInModule<I>(
  m: Module<I>,
  env: Environment
): Module<I & Scoped> {
  const defs = moduleDefinitions(m).map((d) => d.node.variable.name);
  const newenv = [...env, ...defs];
  return {
    ...m,
    body: m.body.map((s) => resolveNamesInSynstax(s, newenv)),
  };
}

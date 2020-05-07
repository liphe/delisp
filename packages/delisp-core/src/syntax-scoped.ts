import { moduleDefinitions } from "./module";
import {
  Expression,
  isDefinition,
  isExpression,
  Module,
  Syntax,
} from "./syntax";
import { mapExpr } from "./syntax-utils";

export interface Scoped {
  variables: string[];
}

type Environment = string[];

function resolveNamesInExpression<EInfo>(
  expr: Expression<EInfo>,
  env: Environment
): Expression<EInfo & Scoped> {
  switch (expr.node.tag) {
    case "function": {
      const args = expr.node.lambdaList.positionalArguments.map((a) => a.name);
      const newenv = [...env, ...args];
      return {
        ...expr,
        node: {
          ...expr.node,
          body: expr.node.body.map((e) => resolveNamesInExpression(e, newenv)),
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
              value: resolveNamesInExpression(b.value, env),
            };
          }),

          body: expr.node.body.map((e) => resolveNamesInExpression(e, newenv)),
        },
        info: {
          ...expr.info,
          variables: env,
        },
      };
    }

    // no new names introduced here
    default: {
      const resolvedExpr = mapExpr(expr, (e) =>
        resolveNamesInExpression(e, env)
      );
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

function resolveNamesInSynstax<EInfo, SInfo>(
  syntax: Syntax<EInfo, SInfo>,
  env: Environment
): Syntax<EInfo & Scoped, SInfo> {
  if (isExpression(syntax)) {
    return resolveNamesInExpression(syntax, env);
  } else if (isDefinition(syntax)) {
    return {
      ...syntax,
      node: {
        ...syntax.node,
        value: resolveNamesInExpression(syntax.node.value, env),
      },
      info: {
        ...syntax.info,
        variables: env,
      },
    };
  } else {
    return syntax;
  }
}

export function resolveNamesInModule<EInfo, SInfo>(
  m: Module<EInfo, SInfo>,
  env: Environment
): Module<EInfo & Scoped, SInfo> {
  const defs = moduleDefinitions(m).map((d) => d.node.variable.name);
  const newenv = [...env, ...defs];
  return {
    ...m,
    body: m.body.map((s) => resolveNamesInSynstax(s, newenv)),
  };
}

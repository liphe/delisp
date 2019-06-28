import { Expression, Typed } from "./syntax";
import { foldExpr } from "./syntax-utils";
import { TypeWithWildcards } from "./type-wildcards";

export function typeAnnotate(expr: Expression<Typed>): Expression {
  return foldExpr(expr, e => {
    return {
      node: {
        tag: "type-annotation",
        typeWithWildcards: new TypeWithWildcards(e.info.type),
        value: e
      },
      info: {},
      location: e.location
    };
  });
}

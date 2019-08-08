import { Expression } from "./syntax";
import { Typed } from "./syntax-typed";
import { foldExpr } from "./syntax-utils";
import { TypeWithWildcards } from "./type-wildcards";

export function typeAnnotate(expr: Expression<Typed>): Expression {
  return foldExpr(expr, e => {
    return {
      node: {
        tag: "type-annotation",
        typeWithWildcards: new TypeWithWildcards(e.info.resultingType),
        value: e
      },
      info: {},
      location: e.location
    };
  });
}

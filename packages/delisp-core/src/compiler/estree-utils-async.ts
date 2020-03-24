import * as JS from "estree";

type MaybeExpression =
  | boolean
  | number
  | string
  | undefined
  | MaybeJSExpressionNode[]
  | MaybeJSExpressionNode;

interface MaybeJSExpressionNode {
  type?: JS.Expression["type"];
  [key: string]: MaybeExpression;
}

/** Check if a body of JS expressions contain a await expression in the same scope.
 *
 * That is to say, not inside another function!
 */
export function isBodyAsync(body: JS.Expression[]) {
  function containsAwait(expr: MaybeExpression): boolean {
    if (
      !expr ||
      typeof expr === "string" ||
      typeof expr === "number" ||
      typeof expr === "boolean"
    ) {
      return false;
    }

    if (Array.isArray(expr)) {
      return expr.some(containsAwait);
    }

    if (!expr.type) {
      return false;
    }

    switch (expr.type) {
      case "AwaitExpression":
        return true;
      case "FunctionExpression":
      case "ArrowFunctionExpression":
        return false;
      default:
        return Object.entries(expr).some(([_, value]) => containsAwait(value));
    }
  }
  return body.some((e) => containsAwait(e as MaybeExpression));
}

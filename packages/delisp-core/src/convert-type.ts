import { printHighlightedExpr } from "./error-report";
import { ASExpr, ASExprList, ASExprSymbol } from "./sexpr";
import { Monotype } from "./types";

function convertSymbol(expr: ASExprSymbol): Monotype {
  switch (expr.name) {
    case "boolean":
      return { type: "boolean" };
    case "number":
      return { type: "number" };
    case "string":
      return { type: "string" };
    default:
      return { type: "type-variable", name: expr.name };
  }
}

function convertList(expr: ASExprList): Monotype {
  const [op, ...args] = expr.elements;

  if (op.type !== "symbol") {
    throw new Error(printHighlightedExpr("Expected symbol as operator", expr));
  }

  if (args.length < 2) {
    throw new Error(
      printHighlightedExpr("Expected at least 2 arguments", expr)
    );
  }

  return {
    type: "application",
    op: op.name,
    args: args.map(convert)
  };
}

export function convert(expr: ASExpr): Monotype {
  switch (expr.type) {
    case "list":
      return convertList(expr);
    case "symbol":
      return convertSymbol(expr);
    default:
      throw new Error(printHighlightedExpr("Not a valid type", expr));
  }
}

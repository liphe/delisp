import { printHighlightedExpr } from "./error-report";
import { ASExpr, ASExprList, ASExprSymbol } from "./sexpr";
import { Type } from "./types";

function convertSymbol(expr: ASExprSymbol): Type {
  switch (expr.name) {
    case "number":
      return { type: "number" };
    case "string":
      return { type: "string" };
    default:
      return { type: "type-variable", name: expr.name };
  }
}

function convertList(expr: ASExprList): Type {
  const [first, from, to] = expr.elements;

  if (first.type !== "symbol" || first.name !== "->") {
    throw new Error(printHighlightedExpr("Expected -> as first symbol", expr));
  }

  if (expr.elements.length !== 3) {
    throw new Error(printHighlightedExpr("Expected 3 elements", expr));
  }

  if (from.type !== "list") {
    throw new Error(
      printHighlightedExpr("Expected second element to be a list", expr)
    );
  }

  return {
    type: "function",
    from: from.elements.map(convert),
    to: convert(to)
  };
}

export function convert(expr: ASExpr): Type {
  switch (expr.type) {
    case "list":
      return convertList(expr);
    case "symbol":
      return convertSymbol(expr);
    default:
      throw new Error(printHighlightedExpr("Not a valid type", expr));
  }
}

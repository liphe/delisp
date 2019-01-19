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
    throw new Error(
      printHighlightedExpr("Expected symbol as operator", expr.location)
    );
  }

  switch (op.name) {
    case "->":
      if (args.length < 1) {
        throw new Error(
          printHighlightedExpr(
            "Expected at least 1 argument",
            op.location,
            true
          )
        );
      }
      break;
    case "list":
      if (args.length !== 1) {
        throw new Error(
          printHighlightedExpr("Expected exactly 1 argument", op.location)
        );
      }
      break;
    default:
      throw new Error(
        printHighlightedExpr("Unknown type constructor", op.location)
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
      throw new Error(printHighlightedExpr("Not a valid type", expr.location));
  }
}

import { parseRecord } from "./convert-utils";
import { printHighlightedExpr } from "./error-report";
import {
  ASExpr,
  ASExprList,
  ASExprMap,
  ASExprSymbol,
  ASExprVector
} from "./sexpr";
import { generateUniqueTVar } from "./type-generate";
import {
  emptyRow,
  Monotype,
  tApp,
  tBoolean,
  tNumber,
  tRecord,
  tString,
  tUserDefined,
  tVar,
  tVector,
  tVoid
} from "./types";

/** Capitalize a string like "foo" to "Foo". */
function capitalize(str: string) {
  if (str === "") {
    return "";
  } else {
    return str[0].toUpperCase() + str.slice(1);
  }
}

/** Return true if a symbol is a valid name for a user defined type, false otherwise. */
export function userDefinedType(expr: ASExprSymbol): boolean {
  return expr.name[0] === expr.name[0].toUpperCase();
}

/** Check if a symbol is a valid user defined type name or throw a user-friendly error otherwise. */
export function checkUserDefinedTypeName(expr: ASExprSymbol): void {
  if (!userDefinedType(expr)) {
    throw new Error(
      printHighlightedExpr(
        `'${
          expr.name
        }' is not a valid name for a type. Type names should start with a capital letter. Try '${capitalize(
          expr.name
        )}'?`,
        expr.location
      )
    );
  }
}

function convertSymbol(expr: ASExprSymbol): Monotype {
  switch (expr.name) {
    case "boolean":
      return tBoolean;
    case "number":
      return tNumber;
    case "string":
      return tString;
    case "void":
      return tVoid;
    case "_":
      return generateUniqueTVar(false, "__t");
    default:
      return userDefinedType(expr) ? tUserDefined(expr.name) : tVar(expr.name);
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
    default:
      throw new Error(
        printHighlightedExpr("Unknown type constructor", op.location)
      );
  }

  return tApp(op.name, ...args.map(convert));
}

function convertVector(expr: ASExprVector): Monotype {
  if (expr.elements.length !== 1) {
    throw new Error(
      printHighlightedExpr("Expected exactly 1 argument", expr.location)
    );
  }
  return tVector(convert(expr.elements[0]));
}

function convertMap(expr: ASExprMap): Monotype {
  const { fields, tail } = parseRecord(expr);

  return tRecord(
    fields.map(({ label, value }) => ({
      label: label.name,
      type: convert(value)
    })),
    tail ? convert(tail) : emptyRow
  );
}

/* Try to convert a S-Expression into a type. */
export function convert(expr: ASExpr): Monotype {
  switch (expr.type) {
    case "list":
      return convertList(expr);
    case "symbol":
      return convertSymbol(expr);
    case "vector":
      return convertVector(expr);
    case "map":
      return convertMap(expr);
    default:
      throw new Error(printHighlightedExpr("Not a valid type", expr.location));
  }
}

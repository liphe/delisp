import { capitalize } from "./utils";
import { ConvertError, parseRecord } from "./convert-utils";
import { printHighlightedExpr } from "./error-report";
import {
  ASExpr,
  ASExprList,
  ASExprMap,
  ASExprSymbol,
  ASExprVector
} from "./sexpr";

import {
  emptyRow,
  Type,
  tApp,
  tBoolean,
  tNumber,
  tRecord,
  tString,
  tUserDefined,
  tVar,
  tVector,
  tVoid,
  tcArrow
} from "./types";

/** Return true if a symbol is a valid name for a user defined type, false otherwise. */
export function userDefinedType(expr: ASExprSymbol): boolean {
  return /^[A-Z]/.test(expr.name);
}

/** Check if a symbol is a valid user defined type name or throw a user-friendly error otherwise. */
export function checkUserDefinedTypeName(expr: ASExprSymbol): void {
  if (!userDefinedType(expr)) {
    throw new ConvertError(
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

function convertSymbol(expr: ASExprSymbol): Type {
  switch (expr.name) {
    case "->":
      return tcArrow;
    case "boolean":
      return tBoolean;
    case "number":
      return tNumber;
    case "string":
      return tString;
    case "void":
      return tVoid;
    default:
      return userDefinedType(expr) ? tUserDefined(expr.name) : tVar(expr.name);
  }
}

function convertList(expr: ASExprList): Type {
  const [op, ...args] = expr.elements;
  const opType = convert(op);
  return tApp(opType, ...args.map(convert));
}

function convertVector(expr: ASExprVector): Type {
  if (expr.elements.length !== 1) {
    throw new ConvertError(
      printHighlightedExpr("Expected exactly 1 argument", expr.location)
    );
  }
  return tVector(convert(expr.elements[0]));
}

function convertMap(expr: ASExprMap): Type {
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
export function convert(expr: ASExpr): Type {
  switch (expr.tag) {
    case "list":
      return convertList(expr);
    case "symbol":
      return convertSymbol(expr);
    case "vector":
      return convertVector(expr);
    case "map":
      return convertMap(expr);
    default:
      throw new ConvertError(
        printHighlightedExpr("Not a valid type", expr.location)
      );
  }
}

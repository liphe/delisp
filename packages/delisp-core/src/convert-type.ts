import { capitalize } from "./utils";
import { ConvertError, parseRecord } from "./convert-utils";
import { printHighlightedExpr } from "./error-report";
import { readFromString } from "./reader";

import {
  ASExpr,
  ASExprList,
  ASExprMap,
  ASExprSymbol,
  ASExprVector
} from "./sexpr";

import {
  emptyRow,
  TConstant,
  TVar,
  Type,
  tApp,
  tBoolean,
  tNumber,
  tRecord,
  tVariant,
  tEffect,
  tString,
  tUserDefined,
  tVar,
  tVector,
  tVoid,
  tcArrow,
  TypeSchema
} from "./types";

import { TypeWithWildcards } from "./type-wildcards";

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

function convertSymbol(expr: ASExprSymbol): TVar | TConstant {
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

function convertEffect(effects: ASExpr[]): Type {
  const labels = effects.map(e => {
    if (e.tag !== "symbol") {
      throw new ConvertError(
        printHighlightedExpr(`not a valid effect`, e.location)
      );
    }
    return e.name;
  });
  const last = labels.slice(-2);
  if (last.length === 2 && last[0] === "|") {
    return tEffect(labels.slice(0, -2), tVar(last[1]));
  } else {
    return tEffect(labels);
  }
}

function convertVariant(op: ASExpr, args: ASExpr[]): Type {
  if (args.length === 0) {
    throw new ConvertError(
      printHighlightedExpr(`Missing row`, op.location, true)
    );
  }

  if (args.length > 1) {
    throw new ConvertError(
      printHighlightedExpr(
        `Too many arguments for a variant type`,
        args[1].location
      )
    );
  }

  const variants = args[0];
  if (variants.tag !== "map") {
    throw new ConvertError(
      printHighlightedExpr(
        `The variants object should look like an record`,
        args[0].location
      )
    );
  }

  const { fields, tail } = parseRecord(variants);
  return tVariant(
    fields.map(r => ({ label: r.label.name, type: convert_(r.value) })),
    tail && convert_(tail)
  );
}

function convertList(expr: ASExprList): Type {
  const [op, ...args] = expr.elements;
  if (op.tag === "symbol" && op.name === "effect") {
    return convertEffect(args);
  } else if (op.tag === "symbol" && op.name === "or") {
    return convertVariant(op, args);
  } else {
    const opType = convert_(op);
    return tApp(opType, ...args.map(convert_));
  }
}

function convertVector(expr: ASExprVector): Type {
  if (expr.elements.length !== 1) {
    throw new ConvertError(
      printHighlightedExpr("Expected exactly 1 argument", expr.location)
    );
  }
  return tVector(convert_(expr.elements[0]));
}

function convertMap(expr: ASExprMap): Type {
  const { fields, tail } = parseRecord(expr);

  return tRecord(
    fields.map(({ label, value }) => ({
      label: label.name,
      type: convert_(value)
    })),
    tail ? convert_(tail) : emptyRow
  );
}

/* Try to convert a S-Expression into a type. */
function convert_(expr: ASExpr): Type {
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

function convertToTypeWithWildcards(expr: ASExpr): TypeWithWildcards {
  return new TypeWithWildcards(convert_(expr));
}

export { convertToTypeWithWildcards as convert };

export function readType(source: string): TypeSchema {
  const t = convertToTypeWithWildcards(readFromString(source));
  return t.generalize();
}

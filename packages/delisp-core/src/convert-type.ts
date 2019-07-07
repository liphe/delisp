import { ConvertError, parseRecord } from "./convert-utils";
import { printHighlightedExpr } from "./error-report";
import { readFromString } from "./reader";
import {
  ASExpr,
  ASExprList,
  ASExprMap,
  ASExprSymbol,
  ASExprVector,
  isSymbolOfName
} from "./sexpr";
import { normalizeValues as doNormalizeValues } from "./type-utils";
import { TypeWithWildcards } from "./type-wildcards";
import * as T from "./types";
import { capitalize, last } from "./utils";

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

function convertSymbol(expr: ASExprSymbol): T.Var | T.Constant {
  switch (expr.name) {
    case "->":
      return T.cArrow;
    case "boolean":
      return T.boolean;
    case "number":
      return T.number;
    case "string":
      return T.string;
    case "void":
      return T.void;
    case "none":
      return T.none;
    case "*":
      return T.cStar;
    default:
      return userDefinedType(expr)
        ? T.userDefined(expr.name)
        : T.var(expr.name);
  }
}

function convertEffect(effects: ASExpr[]): T.Type {
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
    return T.effect(labels.slice(0, -2), T.var(last[1]));
  } else {
    return T.effect(labels);
  }
}

function convertCases(_op: ASExpr, args: ASExpr[]): T.Type {
  const lastArg = last(args);
  let tail: ASExpr | undefined;

  if (lastArg && lastArg.tag === "symbol" && !lastArg.name.startsWith(":")) {
    tail = args.pop();
  }

  function parseCase(c: ASExpr): { label: string; type: T.Type } {
    if (c.tag === "symbol" && c.name.startsWith(":")) {
      return { label: c.name, type: T.void };
    } else if (c.tag === "list") {
      if (c.elements.length !== 2) {
        throw new ConvertError(
          printHighlightedExpr(
            `Invalid case: expected exaclty two elements`,
            c.location
          )
        );
      }
      const [keyword, innerType] = c.elements;
      if (keyword.tag !== "symbol" || !keyword.name.startsWith(":")) {
        throw new ConvertError(
          printHighlightedExpr(
            `Invalid case: expected valid keyword`,
            keyword.location
          )
        );
      }
      return { label: keyword.name, type: convert_(innerType) };
    } else {
      throw new ConvertError(printHighlightedExpr(`Invalid case`, c.location));
    }
  }

  return T.cases(args.map(parseCase), tail && convert_(tail));
}

function convertValues(expr: ASExprList): T.Type {
  let args = expr.elements.slice(1);
  let extending: T.Type | undefined = undefined;
  if (args.length > 2 && isSymbolOfName(args[args.length - 2], "|")) {
    extending = convert_(args[args.length - 1]);
    args = args.slice(0, -2);
  }
  return T.values(args.map(convert_), extending);
}

function convertList(expr: ASExprList): T.Type {
  const [op, ...args] = expr.elements;
  if (isSymbolOfName(op, "effect")) {
    return convertEffect(args);
  } else if (isSymbolOfName(op, "cases")) {
    return convertCases(op, args);
  } else if (isSymbolOfName(op, "values")) {
    return convertValues(expr);
  } else if (isSymbolOfName(op, "->")) {
    if (args.length < 2) {
      throw new ConvertError(`Missing some arguments!`);
    }
    const fnargs = args.slice(0, -2);
    const fneffect = args[args.length - 2];
    const fnout = args[args.length - 1];
    return T.multiValuedFunction(
      fnargs.map(convert_),
      convert_(fneffect),
      convert_(fnout)
    );
  } else {
    const opType = convert_(op);
    return T.app(opType, ...args.map(convert_));
  }
}

function convertVector(expr: ASExprVector): T.Type {
  if (expr.elements.length !== 1) {
    throw new ConvertError(
      printHighlightedExpr("Expected exactly 1 argument", expr.location)
    );
  }
  return T.vector(convert_(expr.elements[0]));
}

function convertMap(expr: ASExprMap): T.Type {
  const { fields, tail } = parseRecord(expr);

  return T.record(
    fields.map(({ label, value }) => ({
      label: label.name,
      type: convert_(value)
    })),
    tail ? convert_(tail) : T.emptyRow
  );
}

/* Try to convert a S-Expression into a type. */
function convert_(expr: ASExpr): T.Type {
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

function convertToTypeWithWildcards(
  expr: ASExpr,
  normalizeValues = true
): TypeWithWildcards {
  const type = convert_(expr);
  return new TypeWithWildcards(
    normalizeValues ? doNormalizeValues(type) : type
  );
}

export { convertToTypeWithWildcards as convert };

export function readType(source: string, normalizeValues = true): T.TypeSchema {
  const t = convertToTypeWithWildcards(readFromString(source), normalizeValues);
  return t.generalize();
}

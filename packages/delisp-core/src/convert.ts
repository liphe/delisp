import { printHighlightedExpr } from "./error-report";
import { ASExpr, ASExprList, ASExprSymbol } from "./sexpr";
import { Declaration, Expression, LambdaList, Syntax } from "./syntax";
import { last } from "./utils";

const conversions: Map<string, (expr: ASExprList) => Expression> = new Map();
const toplevelConversions: Map<
  string,
  (expr: ASExprList) => Declaration
> = new Map();

function defineConversion(name: string, fn: (expr: ASExprList) => Expression) {
  conversions.set(name, fn);
}

function defineToplevel(name: string, fn: (expr: ASExprList) => Declaration) {
  toplevelConversions.set(name, fn);
}

//
// (lambda (...args) body)
//

function parseLambdaList(x: ASExpr): LambdaList {
  if (x.type !== "list") {
    throw new Error(printHighlightedExpr("Expected a list of arguments", x));
  }

  x.elements.forEach(arg => {
    if (arg.type !== "symbol") {
      throw new Error(
        printHighlightedExpr(
          "A list of arguments should be made of symbols",
          arg
        )
      );
    }
  });

  const args = x.elements as ASExprSymbol[];

  // Check for duplicated arguments
  args.forEach((arg, i) => {
    const duplicated = args.slice(i + 1).find(a => a.name === arg.name);
    if (duplicated) {
      throw new Error(
        printHighlightedExpr(
          "There is another argument with the same name",
          duplicated
        )
      );
    }
  });

  return args.map(arg => ({
    variable: arg.name,
    location: arg.location
  }));
}

defineConversion("lambda", expr => {
  const [lambda, ...args] = expr.elements;

  if (args.length !== 2) {
    throw new Error(
      printHighlightedExpr(
        `'lambda' needs exactly 2 arguments, got ${args.length}`,
        last([lambda, ...args]) as ASExpr, // we know it is not empty!
        true
      )
    );
  }
  return {
    type: "function",
    lambdaList: parseLambdaList(args[0]),
    body: convertExpr(args[1]),
    location: expr.location
  };
});

defineToplevel("define", expr => {
  const [define, ...args] = expr.elements;

  if (args.length !== 2) {
    throw new Error(
      printHighlightedExpr(
        `'define' needs exactly 2 arguments, got ${args.length}`,
        last([define, ...args]) as ASExpr,
        true
      )
    );
  }

  const [variable, value] = args;

  if (variable.type !== "symbol") {
    throw new Error(
      printHighlightedExpr("'define' expected a symbol", variable)
    );
  }

  return {
    type: "definition",
    variable: variable.name,
    value: convertExpr(value),
    location: expr.location
  };
});

function specialForm(x: ASExpr) {
  return;
}

function convertList(list: ASExprList): Expression {
  if (list.elements.length === 0) {
    throw new Error(
      printHighlightedExpr("Empty list is not a function call", list)
    );
  }

  const [first] = list.elements;

  const convertSpecialForm =
    first.type === "symbol" ? conversions.get(first.name) : undefined;

  if (convertSpecialForm) {
    return convertSpecialForm(list);
  } else {
    const [fn, ...args] = list.elements;
    return {
      type: "function-call",
      fn: convertExpr(fn),
      args: args.map(convertExpr),
      location: list.location
    };
  }
}

export function convertExpr(expr: ASExpr): Expression {
  switch (expr.type) {
    case "number":
      return expr;
    case "string":
      return expr;
    case "symbol":
      return {
        type: "variable-reference",
        variable: expr.name,
        location: expr.location
      };
    case "list":
      return convertList(expr);
  }
}

export function convert(expr: ASExpr): Syntax {
  if (expr.type === "list") {
    if (expr.elements.length === 0) {
      throw new Error(
        printHighlightedExpr("Empty list is not a function call", expr)
      );
    }

    const [first] = expr.elements;
    const convertDeclaration =
      first.type === "symbol" ? toplevelConversions.get(first.name) : undefined;

    if (convertDeclaration) {
      return convertDeclaration(expr);
    }
  }

  return convertExpr(expr);
}

import { printHighlightedExpr } from "./error-report";
import {
  ASExpr,
  ASExprList,
  ASExprMap,
  ASExprSymbol,
  ASExprVector
} from "./sexpr";
import {
  Declaration,
  Expression,
  LambdaList,
  SLetBinding,
  Syntax
} from "./syntax";
import { last, mapObject } from "./utils";

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
// The format of lambda lists are (a b c ... &rest z)
//

function parseLambdaList(ll: ASExpr): LambdaList {
  if (ll.type !== "list") {
    throw new Error(
      printHighlightedExpr("Expected a list of arguments", ll.location)
    );
  }

  ll.elements.forEach(arg => {
    if (arg.type !== "symbol") {
      throw new Error(
        printHighlightedExpr(
          "A list of arguments should be made of symbols",
          arg.location
        )
      );
    }
  });

  const symbols = ll.elements as ASExprSymbol[];

  // Check for duplicated arguments
  symbols.forEach((arg, i) => {
    const duplicated = symbols.slice(i + 1).find(a => a.name === arg.name);
    if (duplicated) {
      throw new Error(
        printHighlightedExpr(
          "There is another argument with the same name",
          duplicated.location
        )
      );
    }
  });

  return {
    positionalArgs: symbols.map(arg => ({
      variable: arg.name,
      location: arg.location
    })),
    location: ll.location
  };
}

defineConversion("lambda", expr => {
  const [lambda, ...args] = expr.elements;

  if (args.length < 2) {
    const lastExpr = last([lambda, ...args]) as ASExpr; // we know it is not empty!
    throw new Error(
      printHighlightedExpr(
        `'lambda' is missing the body`,
        lastExpr.location,
        true
      )
    );
  }

  return {
    type: "function",
    lambdaList: parseLambdaList(args[0]),
    body: args.slice(1).map(convertExpr),
    location: expr.location,
    info: {}
  };
});

defineConversion("if", expr => {
  if (expr.elements.length !== 4) {
    const lastExpr = last(expr.elements) as ASExpr; // we know it is not empty!
    throw new Error(
      printHighlightedExpr(
        `'if' needs exactly 3 arguments, got ${expr.elements.length}`,
        lastExpr.location,
        true
      )
    );
  }
  const [, conditionForm, consequentForm, alternativeForm] = expr.elements;
  return {
    type: "conditional",
    condition: convertExpr(conditionForm),
    consequent: convertExpr(consequentForm),
    alternative: convertExpr(alternativeForm),
    location: expr.location,
    info: {}
  };
});

function parseLetBindings(bindings: ASExpr): SLetBinding[] {
  if (bindings.type !== "list") {
    throw new Error(
      printHighlightedExpr(`'let' bindings should be a list`, bindings.location)
    );
  }

  const output: SLetBinding[] = [];

  bindings.elements.forEach(binding => {
    if (binding.type !== "list") {
      throw new Error(
        printHighlightedExpr(`'let' binding should be a list`, binding.location)
      );
    }
    if (binding.elements.length !== 2) {
      throw new Error(
        printHighlightedExpr(`ill-formed let binding`, binding.location)
      );
    }

    const [name, value] = binding.elements;

    if (name.type !== "symbol") {
      throw new Error(printHighlightedExpr(`expected a symbol`, name.location));
    }

    output.push({
      var: name.name,
      value: convertExpr(value),
      location: binding.location
    });
  });

  return output;
}

defineConversion("let", expr => {
  const [_let, ...args] = expr.elements;

  if (args.length !== 2) {
    const lastExpr = last([_let, ...args]) as ASExpr; // we know it is not empty!

    throw new Error(
      printHighlightedExpr(
        `'let' needs exactly 2 arguments, got ${args.length}`,
        lastExpr.location,
        true
      )
    );
  }
  const [rawBindings, body] = args;
  return {
    type: "let-bindings",
    bindings: parseLetBindings(rawBindings),
    body: convertExpr(body),
    location: expr.location,
    info: {}
  };
});

defineToplevel("define", expr => {
  const [define, ...args] = expr.elements;

  if (args.length !== 2) {
    const lastExpr = last([define, ...args]) as ASExpr;
    throw new Error(
      printHighlightedExpr(
        `'define' needs exactly 2 arguments, got ${args.length}`,
        lastExpr.location,
        true
      )
    );
  }

  const [variable, value] = args;

  if (variable.type !== "symbol") {
    throw new Error(
      printHighlightedExpr("'define' expected a symbol", variable.location)
    );
  }

  return {
    type: "definition",
    variable: variable.name,
    value: convertExpr(value),
    location: expr.location
  };
});

defineToplevel("export", expr => {
  const [exp, ...args] = expr.elements;

  if (args.length !== 2) {
    const lastExpr = last([exp, ...args]) as ASExpr;
    throw new Error(
      printHighlightedExpr(
        `'export' needs exactly 2 arguments, got ${args.length}`,
        lastExpr.location,
        true
      )
    );
  }

  const [name, value] = args;

  if (name.type !== "symbol") {
    throw new Error(
      printHighlightedExpr("'export' expected a symbol", name.location)
    );
  }

  return {
    type: "export",
    name: name.name,
    value: convertExpr(value),
    location: expr.location
  };
});

function convertList(list: ASExprList): Expression {
  if (list.elements.length === 0) {
    throw new Error(
      printHighlightedExpr("Empty list is not a function call", list.location)
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
      location: list.location,
      info: {}
    };
  }
}

function convertVector(list: ASExprVector): Expression {
  return {
    type: "vector",
    values: list.elements.map(a => convertExpr(a)),
    location: list.location,
    info: {}
  };
}

function convertMap(map: ASExprMap): Expression {
  return {
    type: "record",
    fields: mapObject(map.fields, convertExpr),
    location: map.location,
    info: {}
  };
}

export function convertExpr(expr: ASExpr): Expression {
  switch (expr.type) {
    case "number":
      return { ...expr, info: {} };
    case "string":
      return { ...expr, info: {} };
    case "symbol":
      return {
        type: "variable-reference",
        name: expr.name,
        location: expr.location,
        info: {}
      };
    case "list":
      return convertList(expr);
    case "vector":
      return convertVector(expr);
    case "map":
      return convertMap(expr);
  }
}

export function convert(expr: ASExpr): Syntax {
  if (expr.type === "list") {
    if (expr.elements.length === 0) {
      throw new Error(
        printHighlightedExpr("Empty list is not a function call", expr.location)
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

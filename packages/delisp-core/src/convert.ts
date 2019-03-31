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
  ExpressionF,
  SLetBindingF,
  LambdaList,
  SIdentifier,
  Syntax
} from "./syntax";
import { last } from "./utils";

import {
  checkUserDefinedTypeName,
  convert as convertType
} from "./convert-type";
import { parseRecord } from "./convert-utils";
import { listTypeVariables } from "./type-utils";
import { TypeWithWildcards } from "./type-wildcards";

const conversions: Map<string, (expr: ASExprList) => ExpressionF> = new Map();
const toplevelConversions: Map<
  string,
  (expr: ASExprList) => Declaration
> = new Map();

function defineConversion(name: string, fn: (expr: ASExprList) => ExpressionF) {
  conversions.set(name, fn);
}

function defineToplevel(name: string, fn: (expr: ASExprList) => Declaration) {
  toplevelConversions.set(name, fn);
}

function parseBody(anchor: ASExpr, exprs: ASExpr[]): Expression[] {
  if (exprs.length === 0) {
    throw new Error(
      printHighlightedExpr(`body can't be empty`, anchor.location, true)
    );
  }
  return exprs.map(convertExpr);
}

//
// The format of lambda lists are (a b c ... &rest z)
//

function parseLambdaList(ll: ASExpr): LambdaList {
  if (ll.tag !== "list") {
    throw new Error(
      printHighlightedExpr("Expected a list of arguments", ll.location)
    );
  }

  ll.elements.forEach(arg => {
    if (arg.tag !== "symbol") {
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
    positionalArgs: symbols.map(convertSymbol),
    location: ll.location
  };
}

defineConversion("lambda", expr => {
  const [lambda, ...args] = expr.elements;
  const lastExpr = last([lambda, ...args]) as ASExpr; // we kj

  if (args.length === 0) {
    throw new Error(
      printHighlightedExpr(
        `'lambda' is missing the argument list`,
        lastExpr.location,
        true
      )
    );
  }

  const body = parseBody(lastExpr, args.slice(1));

  return {
    tag: "function",
    lambdaList: parseLambdaList(args[0]),
    body,
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
    tag: "conditional",
    condition: convertExpr(conditionForm),
    consequent: convertExpr(consequentForm),
    alternative: convertExpr(alternativeForm),
    location: expr.location,
    info: {}
  };
});

function parseLetBindings(
  bindings: ASExpr
): Array<SLetBindingF<{}, Expression>> {
  if (bindings.tag !== "map") {
    throw new Error(
      printHighlightedExpr(`'let' bindings should be a map`, bindings.location)
    );
  }
  return bindings.fields.map(field => ({
    variable: convertSymbol(field.label),
    value: convertExpr(field.value)
  }));
}

defineConversion("let", expr => {
  const [_let, ...args] = expr.elements;
  const lastExpr = last([_let, ...args]) as ASExpr; // we know it is not empty!

  if (args.length === 0) {
    throw new Error(
      printHighlightedExpr(
        `'let' is missing the bindings`,
        lastExpr.location,
        true
      )
    );
  }

  const [rawBindings, ...rawBody] = args;

  return {
    tag: "let-bindings",
    bindings: parseLetBindings(rawBindings),
    body: parseBody(lastExpr, rawBody),
    location: expr.location,
    info: {}
  };
});

defineConversion("the", expr => {
  const [_the, ...args] = expr.elements;
  const lastExpr = last([_the, ...args]) as ASExpr; // we know it is not empty!

  if (args.length === 0) {
    throw new Error(
      printHighlightedExpr(
        `'the' is missing the type and value`,
        lastExpr.location,
        true
      )
    );
  }
  if (args.length === 1) {
    throw new Error(
      printHighlightedExpr(
        `'the' is missing the expression`,
        lastExpr.location,
        true
      )
    );
  }

  if (args.length > 2) {
    throw new Error(
      printHighlightedExpr(
        `Too many arguments. 'the' should take two arguments.`,
        args[2].location,
        true
      )
    );
  }

  const [t, value] = args;

  return {
    tag: "type-annotation",
    typeWithWildcards: new TypeWithWildcards(convertType(t)),
    value: convertExpr(value),
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

  if (variable.tag !== "symbol") {
    throw new Error(
      printHighlightedExpr("'define' expected a symbol", variable.location)
    );
  }

  return {
    node: {
      tag: "definition",
      variable: convertSymbol(variable),
      value: convertExpr(value),
      location: expr.location
    }
  };
});

defineToplevel("export", expr => {
  const [exp, ...args] = expr.elements;

  if (args.length !== 1) {
    const lastExpr = last([exp, ...args]) as ASExpr;
    throw new Error(
      printHighlightedExpr(
        `'export' needs exactly 1 arguments, got ${args.length}`,
        lastExpr.location,
        true
      )
    );
  }

  const [variable] = args;

  if (variable.tag !== "symbol") {
    throw new Error(
      printHighlightedExpr("'export' expected a symbol", variable.location)
    );
  }

  return {
    node: {
      tag: "export",
      value: convertSymbol(variable),
      location: expr.location
    }
  };
});

defineToplevel("type", expr => {
  const [typeOp, ...args] = expr.elements;

  if (args.length !== 2) {
    const lastExpr = last([typeOp, ...args]) as ASExpr;
    throw new Error(
      printHighlightedExpr(
        `'type' needs exactly 2 arguments, got ${args.length}`,
        lastExpr.location,
        true
      )
    );
  }

  const [name, definition] = args;

  if (name.tag !== "symbol") {
    throw new Error(
      printHighlightedExpr("'type' expected a symbol as a name", name.location)
    );
  }

  checkUserDefinedTypeName(name);

  const definitionType = convertType(definition);
  if (listTypeVariables(definitionType).length > 0) {
    throw new Error(
      printHighlightedExpr("Type variable out of scope", definition.location)
    );
  }

  return {
    node: {
      tag: "type-alias",
      alias: convertSymbol(name),
      definition: definitionType,
      location: expr.location
    }
  };
});

function convertList(list: ASExprList): ExpressionF {
  if (list.elements.length === 0) {
    throw new Error(
      printHighlightedExpr("Empty list is not a function call", list.location)
    );
  }

  const [first] = list.elements;

  const convertSpecialForm =
    first.tag === "symbol" ? conversions.get(first.name) : undefined;

  if (convertSpecialForm) {
    return convertSpecialForm(list);
  } else {
    const [fn, ...args] = list.elements;
    return {
      tag: "function-call",
      fn: convertExpr(fn),
      args: args.map(convertExpr),
      location: list.location,
      info: {}
    };
  }
}

function convertVector(list: ASExprVector): ExpressionF {
  return {
    tag: "vector",
    values: list.elements.map(convertExpr),
    location: list.location,
    info: {}
  };
}

function convertMap(map: ASExprMap): ExpressionF {
  const { fields, tail } = parseRecord(map);

  return {
    tag: "record",
    fields: fields.map(f => ({
      label: convertSymbol(f.label),
      value: convertExpr(f.value)
    })),
    extends: tail && convertExpr(tail),
    location: map.location,
    info: {}
  };
}

function convertSymbol(expr: ASExprSymbol): SIdentifier {
  return {
    tag: "identifier",
    name: expr.name,
    location: expr.location,
    info: {}
  };
}

export function convertExpr(expr: ASExpr): Expression {
  function node(node: ExpressionF): Expression {
    return { node };
  }
  switch (expr.tag) {
    case "number":
      return node({ ...expr, info: {} });
    case "string":
      return node({ ...expr, info: {} });
    case "symbol":
      return node(convertSymbol(expr));
    case "list":
      return node(convertList(expr));
    case "vector":
      return node(convertVector(expr));
    case "map":
      return node(convertMap(expr));
  }
}

export function convert(expr: ASExpr): Syntax {
  if (expr.tag === "list") {
    if (expr.elements.length === 0) {
      throw new Error(
        printHighlightedExpr("Empty list is not a function call", expr.location)
      );
    }

    const [first] = expr.elements;
    const convertDeclaration =
      first.tag === "symbol" ? toplevelConversions.get(first.name) : undefined;

    if (convertDeclaration) {
      return convertDeclaration(expr);
    }
  }

  return convertExpr(expr);
}

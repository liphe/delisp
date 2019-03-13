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
  SVariableReference,
  Syntax
} from "./syntax";
import { last } from "./utils";

import { convert as convertType } from "./convert-type";
import { parseRecord } from "./convert-utils";
import { generalize } from "./type-utils";

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
    type: "function",
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

  const body = parseBody(lastExpr, rawBody);

  return {
    type: "let-bindings",
    bindings: parseLetBindings(rawBindings),
    body,
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

  const [t, value] = args;

  return {
    type: "type-annotation",
    valueType: generalize(convertType(t), []),
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

  if (variable.type !== "symbol") {
    throw new Error(
      printHighlightedExpr("'export' expected a symbol", variable.location)
    );
  }

  return {
    type: "export",
    value: convertSymbol(variable),
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
  const { fields, tail } = parseRecord(map);

  return {
    type: "record",
    fields: fields.map(f => ({
      label: f.label.name,
      labelLocation: f.label.location,
      value: convertExpr(f.value)
    })),
    extends: tail && convertExpr(tail),
    location: map.location,
    info: {}
  };
}

function convertSymbol(expr: ASExprSymbol): SVariableReference {
  return {
    type: "variable-reference",
    name: expr.name,
    location: expr.location,
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
      return convertSymbol(expr);
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

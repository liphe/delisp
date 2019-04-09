import { printHighlightedExpr } from "./error-report";
import {
  ASExpr,
  ASExprList,
  ASExprMap,
  ASExprSymbol,
  ASExprVector
} from "./sexpr";
import {
  Identifier,
  Declaration,
  Expression,
  SLetBindingF,
  LambdaList,
  SVariableReference,
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

class ConvertError extends Error {}

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
    throw new ConvertError(
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
    throw new ConvertError(
      printHighlightedExpr("Expected a list of arguments", ll.location)
    );
  }

  ll.elements.forEach(arg => {
    if (arg.tag !== "symbol") {
      throw new ConvertError(
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
      throw new ConvertError(
        printHighlightedExpr(
          "There is another argument with the same name",
          duplicated.location
        )
      );
    }
  });

  return {
    positionalArgs: symbols.map(parseIdentifier),
    location: ll.location
  };
}

defineConversion("lambda", expr => {
  const [lambda, ...args] = expr.elements;
  const lastExpr = last([lambda, ...args]) as ASExpr; // we kj

  if (args.length === 0) {
    throw new ConvertError(
      printHighlightedExpr(
        `'lambda' is missing the argument list`,
        lastExpr.location,
        true
      )
    );
  }

  const body = parseBody(lastExpr, args.slice(1));

  return {
    node: {
      tag: "function",
      lambdaList: parseLambdaList(args[0]),
      body
    },
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
    node: {
      tag: "conditional",
      condition: convertExpr(conditionForm),
      consequent: convertExpr(consequentForm),
      alternative: convertExpr(alternativeForm)
    },
    location: expr.location,
    info: {}
  };
});

function parseLetBindings(bindings: ASExpr): Array<SLetBindingF<Expression>> {
  if (bindings.tag !== "map") {
    throw new ConvertError(
      printHighlightedExpr(`'let' bindings should be a map`, bindings.location)
    );
  }
  return bindings.fields.map(field => ({
    variable: parseIdentifier(field.label),
    value: convertExpr(field.value)
  }));
}

defineConversion("let", expr => {
  const [_let, ...args] = expr.elements;
  const lastExpr = last([_let, ...args]) as ASExpr; // we know it is not empty!

  if (args.length === 0) {
    throw new ConvertError(
      printHighlightedExpr(
        `'let' is missing the bindings`,
        lastExpr.location,
        true
      )
    );
  }

  const [rawBindings, ...rawBody] = args;

  return {
    node: {
      tag: "let-bindings",
      bindings: parseLetBindings(rawBindings),
      body: parseBody(lastExpr, rawBody)
    },
    location: expr.location,
    info: {}
  };
});

defineConversion("the", expr => {
  const [_the, ...args] = expr.elements;
  const lastExpr = last([_the, ...args]) as ASExpr; // we know it is not empty!

  if (args.length === 0) {
    throw new ConvertError(
      printHighlightedExpr(
        `'the' is missing the type and value`,
        lastExpr.location,
        true
      )
    );
  }
  if (args.length === 1) {
    throw new ConvertError(
      printHighlightedExpr(
        `'the' is missing the expression`,
        lastExpr.location,
        true
      )
    );
  }

  if (args.length > 2) {
    throw new ConvertError(
      printHighlightedExpr(
        `Too many arguments. 'the' should take two arguments.`,
        args[2].location,
        true
      )
    );
  }

  const [t, value] = args;

  return {
    node: {
      tag: "type-annotation",
      typeWithWildcards: new TypeWithWildcards(convertType(t)),
      value: convertExpr(value)
    },
    location: expr.location,
    info: {}
  };
});

defineConversion("do", expr => {
  const [_do, ...args] = expr.elements;
  const lastExpr = last([_do, ...args]) as ASExpr; // we know it is not empty!

  if (args.length === 0) {
    throw new ConvertError(
      printHighlightedExpr(`empty body`, lastExpr.location, true)
    );
  }
  const middleForms = args.slice(0, -1);
  const lastForm = last(args)!;
  return {
    node: {
      tag: "do-block",
      body: middleForms.map(convertExpr),
      returning: convertExpr(lastForm)
    },
    location: expr.location,
    info: {}
  };
});

defineToplevel("define", expr => {
  const [define, ...args] = expr.elements;

  if (args.length !== 2) {
    const lastExpr = last([define, ...args]) as ASExpr;
    throw new ConvertError(
      printHighlightedExpr(
        `'define' needs exactly 2 arguments, got ${args.length}`,
        lastExpr.location,
        true
      )
    );
  }

  const [variable, value] = args;

  if (variable.tag !== "symbol") {
    throw new ConvertError(
      printHighlightedExpr("'define' expected a symbol", variable.location)
    );
  }

  return {
    node: {
      tag: "definition",
      variable: parseIdentifier(variable),
      value: convertExpr(value)
    },
    location: expr.location
  };
});

defineToplevel("export", expr => {
  const [exp, ...args] = expr.elements;

  if (args.length !== 1) {
    const lastExpr = last([exp, ...args]) as ASExpr;
    throw new ConvertError(
      printHighlightedExpr(
        `'export' needs exactly 1 arguments, got ${args.length}`,
        lastExpr.location,
        true
      )
    );
  }

  const [variable] = args;

  if (variable.tag !== "symbol") {
    throw new ConvertError(
      printHighlightedExpr("'export' expected a symbol", variable.location)
    );
  }

  return {
    node: {
      tag: "export",
      value: parseIdentifier(variable)
    },
    location: expr.location
  };
});

defineToplevel("type", expr => {
  const [typeOp, ...args] = expr.elements;

  if (args.length !== 2) {
    const lastExpr = last([typeOp, ...args]) as ASExpr;
    throw new ConvertError(
      printHighlightedExpr(
        `'type' needs exactly 2 arguments, got ${args.length}`,
        lastExpr.location,
        true
      )
    );
  }

  const [name, definition] = args;

  if (name.tag !== "symbol") {
    throw new ConvertError(
      printHighlightedExpr("'type' expected a symbol as a name", name.location)
    );
  }

  checkUserDefinedTypeName(name);

  const definitionType = convertType(definition);
  if (listTypeVariables(definitionType).length > 0) {
    throw new ConvertError(
      printHighlightedExpr("Type variable out of scope", definition.location)
    );
  }

  return {
    node: {
      tag: "type-alias",
      alias: parseIdentifier(name),
      definition: definitionType
    },
    location: expr.location
  };
});

function convertList(list: ASExprList): Expression {
  if (list.elements.length === 0) {
    throw new ConvertError(
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
      node: {
        tag: "function-call",
        fn: convertExpr(fn),
        args: args.map(convertExpr)
      },
      location: list.location,
      info: {}
    };
  }
}

function convertVector(list: ASExprVector): Expression {
  return {
    node: {
      tag: "vector",
      values: list.elements.map(convertExpr)
    },
    location: list.location,
    info: {}
  };
}

function convertMap(map: ASExprMap): Expression {
  const { fields, tail } = parseRecord(map);

  return {
    node: {
      tag: "record",
      fields: fields.map(f => ({
        label: parseIdentifier(f.label),
        value: convertExpr(f.value)
      })),
      extends: tail && convertExpr(tail)
    },
    location: map.location,
    info: {}
  };
}

function parseIdentifier(expr: ASExprSymbol): Identifier {
  return {
    tag: "identifier",
    name: expr.name,
    location: expr.location
  };
}

function convertSymbol(expr: ASExprSymbol): SVariableReference {
  const id = parseIdentifier(expr);
  return {
    node: {
      tag: "variable-reference",
      name: id.name
    },
    info: {},
    location: id.location
  };
}

export function convertExpr(expr: ASExpr): Expression {
  switch (expr.tag) {
    case "number":
      return {
        node: { tag: "number", value: expr.value },
        info: {},
        location: expr.location
      };
    case "string":
      return {
        node: { tag: "string", value: expr.value },
        info: {},
        location: expr.location
      };
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
  if (expr.tag === "list") {
    if (expr.elements.length === 0) {
      throw new ConvertError(
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

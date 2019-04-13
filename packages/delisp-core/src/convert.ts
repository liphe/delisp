import { InvariantViolation, assertNever } from "./invariant";
import { Location } from "./input";
import { printHighlightedExpr } from "./error-report";
import {
  ASExpr,
  ASExprList,
  ASExprMap,
  ASExprSymbol,
  ASExprVector
} from "./sexpr";
import {
  isExpression,
  Identifier,
  Declaration,
  Expression,
  SLetBindingF,
  LambdaList,
  Syntax
} from "./syntax";
import { foldExpr, exprFChildren } from "./syntax-utils";
import { flatten, last } from "./utils";

import {
  checkUserDefinedTypeName,
  convert as convertType
} from "./convert-type";
import { ConvertError, parseRecord } from "./convert-utils";
import { listTypeVariables } from "./type-utils";
import { TypeWithWildcards } from "./type-wildcards";

export interface WithErrors {
  errors: string[];
}

type ExpressionWithErrors = Expression<WithErrors>;
type DeclarationWithErrors = Declaration<WithErrors, WithErrors>;
type SyntaxWithErrors = Syntax<WithErrors, WithErrors>;

function result(
  node: ExpressionWithErrors["node"],
  location: Location,
  errors: string[]
): ExpressionWithErrors {
  return { node, info: { errors }, location };
}

function success(
  node: ExpressionWithErrors["node"],
  location: Location
): ExpressionWithErrors {
  return result(node, location, []);
}

type ConversionHandler<A> = (
  id: ASExprSymbol,
  args: ASExpr[],
  whole: ASExprList
) => A;

const conversions: Map<
  string,
  ConversionHandler<ExpressionWithErrors>
> = new Map();

const toplevelConversions: Map<
  string,
  ConversionHandler<DeclarationWithErrors>
> = new Map();

function defineConversion(
  name: string,
  fn: ConversionHandler<ExpressionWithErrors>
) {
  conversions.set(name, fn);
}

function defineToplevel(
  name: string,
  fn: ConversionHandler<DeclarationWithErrors>
) {
  toplevelConversions.set(name, fn);
}

function parseBody(anchor: ASExpr, exprs: ASExpr[]): ExpressionWithErrors[] {
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

defineConversion("lambda", (lambda_, args, whole) => {
  const lastExpr = last([lambda_, ...args]) as ASExpr;

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

  return success(
    {
      tag: "function",
      lambdaList: parseLambdaList(args[0]),
      body
    },
    whole.location
  );
});

function missingFrom(expr: ASExpr): ExpressionWithErrors {
  const location = {
    ...expr.location,
    start: expr.location.end,
    end: expr.location.end
  };
  return success({ tag: "unknown" }, location);
}

function checkArguments(
  anchor: ASExpr,
  args: ASExpr[],
  options: {
    atLeast?: number;
    atMost?: number;
    fewArguments: string;
    manyArguments: string;
  }
): string[] {
  const atLeast = options.atLeast || 0;
  const atMost = options.atMost || Infinity;

  if (!(0 <= atLeast && atLeast <= atMost)) {
    throw new InvariantViolation(`checkArguments: 0 <= atLeast <= atMost`);
  }

  if (args.length < atLeast) {
    return [
      printHighlightedExpr(
        options.fewArguments,
        last([anchor, ...args])!.location,
        true
      )
    ];
  }

  if (args.length > atMost) {
    return [
      printHighlightedExpr(options.fewArguments, args[atMost].location, true)
    ];
  }
  return [];
}

defineConversion("if", (if_, args, whole) => {
  const errors = checkArguments(if_, args, {
    atLeast: 3,
    atMost: 3,
    fewArguments: `'if' needs exactly 3 arguments, got ${args.length}`,
    manyArguments: `'if' needs exactly 3 arguments, got ${args.length}`
  });

  const [conditionForm, consequentForm, alternativeForm] = args;

  const condition = conditionForm
    ? convertExpr(conditionForm)
    : missingFrom(whole);
  const consequent = consequentForm
    ? convertExpr(consequentForm)
    : missingFrom(whole);
  const alternative = alternativeForm
    ? convertExpr(alternativeForm)
    : missingFrom(whole);

  return result(
    {
      tag: "conditional",
      condition,
      consequent,
      alternative
    },
    whole.location,
    errors
  );
});

function parseLetBindings(
  bindings: ASExpr
): Array<SLetBindingF<ExpressionWithErrors>> {
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

defineConversion("let", (let_, args, whole) => {
  const lastExpr = last([let_, ...args]) as ASExpr; // we know it is not empty!

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

  return success(
    {
      tag: "let-bindings",
      bindings: parseLetBindings(rawBindings),
      body: parseBody(lastExpr, rawBody)
    },
    whole.location
  );
});

defineConversion("the", (the_, args, whole) => {
  const lastExpr = last([the_, ...args]) as ASExpr; // we know it is not empty!

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

  return success(
    {
      tag: "type-annotation",
      typeWithWildcards: new TypeWithWildcards(convertType(t)),
      value: convertExpr(value)
    },
    whole.location
  );
});

defineConversion("do", (do_, args, whole) => {
  const lastExpr = last([do_, ...args]) as ASExpr; // we know it is not empty!

  if (args.length === 0) {
    throw new ConvertError(
      printHighlightedExpr(`empty body`, lastExpr.location, true)
    );
  }
  const middleForms = args.slice(0, -1);
  const lastForm = last(args)!;
  return success(
    {
      tag: "do-block",
      body: middleForms.map(convertExpr),
      returning: convertExpr(lastForm)
    },
    whole.location
  );
});

defineToplevel("define", (define_, args, whole) => {
  if (args.length !== 2) {
    const lastExpr = last([define_, ...args]) as ASExpr;
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
    location: whole.location,
    info: {
      errors: []
    }
  };
});

defineToplevel("export", (export_, args, whole) => {
  if (args.length !== 1) {
    const lastExpr = last([export_, ...args]) as ASExpr;
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
    location: whole.location,
    info: {
      errors: []
    }
  };
});

defineToplevel("type", (type_, args, whole) => {
  if (args.length !== 2) {
    const lastExpr = last([type_, ...args]) as ASExpr;
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
    location: whole.location,
    info: {
      errors: []
    }
  };
});

function convertList(list: ASExprList): ExpressionWithErrors {
  if (list.elements.length === 0) {
    throw new ConvertError(
      printHighlightedExpr("Empty list is not a function call", list.location)
    );
  }

  const [first, ...args] = list.elements;

  const convertSpecialForm =
    first.tag === "symbol" ? conversions.get(first.name) : undefined;

  if (first.tag === "symbol" && convertSpecialForm) {
    return convertSpecialForm(first, args, list);
  } else {
    const [fn, ...args] = list.elements;
    return success(
      {
        tag: "function-call",
        fn: convertExpr(fn),
        args: args.map(convertExpr)
      },
      list.location
    );
  }
}

function convertVector(list: ASExprVector): ExpressionWithErrors {
  return success(
    {
      tag: "vector",
      values: list.elements.map(convertExpr)
    },
    list.location
  );
}

function convertMap(map: ASExprMap): ExpressionWithErrors {
  const { fields, tail } = parseRecord(map);
  return success(
    {
      tag: "record",
      fields: fields.map(f => ({
        label: parseIdentifier(f.label),
        value: convertExpr(f.value)
      })),
      extends: tail && convertExpr(tail)
    },
    map.location
  );
}

function parseIdentifier(expr: ASExprSymbol): Identifier {
  return {
    tag: "identifier",
    name: expr.name,
    location: expr.location
  };
}

function convertSymbol(expr: ASExprSymbol): ExpressionWithErrors {
  const id = parseIdentifier(expr);
  return success(
    {
      tag: "variable-reference",
      name: id.name
    },
    id.location
  );
}

function convertExprOrError(expr: ASExpr): ExpressionWithErrors {
  switch (expr.tag) {
    case "number":
      return success({ tag: "number", value: expr.value }, expr.location);
    case "string":
      return success({ tag: "string", value: expr.value }, expr.location);
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

function convertExpr(expr: ASExpr): ExpressionWithErrors {
  try {
    return convertExprOrError(expr);
  } catch (err) {
    if (err instanceof ConvertError) {
      return result({ tag: "unknown" }, expr.location, [err.message]);
    } else {
      throw err;
    }
  }
}

function convertOrError(form: ASExpr): SyntaxWithErrors {
  if (form.tag === "list") {
    if (form.elements.length === 0) {
      throw new ConvertError(
        printHighlightedExpr("Empty list is not a function call", form.location)
      );
    }

    const [first, ...args] = form.elements;
    const convertDeclaration =
      first.tag === "symbol" ? toplevelConversions.get(first.name) : undefined;

    if (first.tag === "symbol" && convertDeclaration) {
      return convertDeclaration(first, args, form);
    }
  }

  return convertExpr(form);
}

export function convert(form: ASExpr): SyntaxWithErrors {
  try {
    return convertOrError(form);
  } catch (err) {
    if (err instanceof ConvertError) {
      return result({ tag: "unknown" }, form.location, [err.message]);
    } else {
      throw err;
    }
  }
}

//
// Extracing errors
//

function collectConvertExprErrors(expr: ExpressionWithErrors): string[] {
  return foldExpr(expr, e => [...e.info.errors, ...flatten(exprFChildren(e))]);
}

export function collectConvertErrors(syntax: SyntaxWithErrors): string[] {
  if (isExpression(syntax)) {
    return collectConvertExprErrors(syntax);
  } else {
    switch (syntax.node.tag) {
      case "export":
      case "type-alias":
        return syntax.info.errors;
      case "definition":
        return [
          ...syntax.info.errors,
          ...collectConvertExprErrors(syntax.node.value)
        ];
      default:
        return assertNever(syntax.node);
    }
  }
}

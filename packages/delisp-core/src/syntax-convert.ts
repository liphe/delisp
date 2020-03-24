import {
  checkUserDefinedTypeName,
  convert as convertType,
} from "./type-convert";
import { ConvertError, parseRecord, ParseRecordResult } from "./convert-utils";
import { printHighlightedExpr } from "./error-report";
import { nolocation, Location } from "./input";
import { assertNever, InvariantViolation } from "./invariant";
import { readFromString } from "./reader";
import {
  ASExpr,
  ASExprList,
  ASExprMap,
  ASExprSymbol,
  ASExprVector,
} from "./sexpr";
import * as S from "./syntax";
import { exprFChildren, foldExpr } from "./syntax-utils";
import { listTypeVariables } from "./type-utils";
import { flatten, last, maybeMap } from "./utils";

export interface WithErrors {
  errors: string[];
}

type ExpressionWithErrors = S.Expression<WithErrors>;
type DeclarationWithErrors = S.Declaration<WithErrors, WithErrors>;
type SyntaxWithErrors = S.Syntax<WithErrors, WithErrors>;

function result(
  node: ExpressionWithErrors["node"],
  location: Location,
  errors: string[]
): ExpressionWithErrors {
  return { node, info: { errors }, location };
}

function successFrom(
  sexpr: ASExpr,
  node: ExpressionWithErrors["node"]
): ExpressionWithErrors {
  return result(node, sexpr.location, []);
}

function missingFrom(
  expr: ASExpr,
  errors: string[] = []
): ExpressionWithErrors {
  const location = {
    ...expr.location,
    start: expr.location.end,
    end: expr.location.end,
  };
  return result({ tag: "unknown" }, location, errors);
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
    return [missingFrom(anchor, [`body can't be empty`])];
  }
  return exprs.map(convertExpr);
}

//
// The format of lambda lists are (a b c ... &rest z)
//

function parseLambdaList(ll: ASExpr): S.LambdaList {
  if (ll.tag !== "list") {
    throw new ConvertError(
      printHighlightedExpr("Expected a list of arguments", ll.location)
    );
  }

  ll.elements.forEach((arg) => {
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
    const duplicated = symbols.slice(i + 1).find((a) => a.name === arg.name);
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
    tag: "function-lambda-list",
    positionalArguments: symbols.map(parseIdentifier),
    location: ll.location,
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

  return successFrom(whole, {
    tag: "function",
    lambdaList: parseLambdaList(args[0]),
    body,
  });
});

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
      ),
    ];
  }

  if (args.length > atMost) {
    return [
      printHighlightedExpr(options.fewArguments, args[atMost].location, true),
    ];
  }
  return [];
}

defineConversion("if", (if_, args, whole) => {
  const errors = checkArguments(if_, args, {
    atLeast: 3,
    atMost: 3,
    fewArguments: `'if' needs exactly 3 arguments, got ${args.length}`,
    manyArguments: `'if' needs exactly 3 arguments, got ${args.length}`,
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
      alternative,
    },
    whole.location,
    errors
  );
});

defineConversion("$get", ($get_, args, whole) => {
  const errors = checkArguments($get_, args, {
    atLeast: 2,
    atMost: 2,
    fewArguments: `'$get' needs exactly 2 arguments, got ${args.length}`,
    manyArguments: `'$get' needs exactly 2 arguments, got ${args.length}`,
  });

  const [keyForm, valueForm] = args;

  if (keyForm.tag !== "symbol" || !keyForm.name.startsWith(":")) {
    throw new ConvertError(`Invalid tag!`);
  }

  const value = convertExpr(valueForm);

  return result(
    {
      tag: "record-get",
      field: {
        tag: "identifier",
        name: keyForm.name,
        location: keyForm.location,
      },
      value,
    },
    whole.location,
    errors
  );
});

function parseLetBindings(
  bindings: ASExpr
): S.SLetBindingF<ExpressionWithErrors>[] {
  if (bindings.tag !== "map") {
    throw new ConvertError(
      printHighlightedExpr(`'let' bindings should be a map`, bindings.location)
    );
  }
  return bindings.fields.map((field) => ({
    tag: "let-bindings-binding",
    variable: parseIdentifier(field.label),
    value: convertExpr(field.value),
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

  return successFrom(whole, {
    tag: "let-bindings",
    bindings: parseLetBindings(rawBindings),
    body: parseBody(lastExpr, rawBody),
  });
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

  return successFrom(whole, {
    tag: "type-annotation",
    typeWithWildcards: convertType(t),
    value: convertExpr(value),
  });
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
  return successFrom(whole, {
    tag: "do-block",
    body: middleForms.map(convertExpr),
    returning: convertExpr(lastForm),
  });
});

defineConversion("match", (_match, args, whole) => {
  const errors: string[] = [];

  let [valueForm, ...caseForms] = args;
  let defaultCaseForm: ASExprList | undefined;

  const value = valueForm
    ? convertExpr(valueForm)
    : missingFrom(whole, [`missing match value`]);

  function isDefaultCase(matchCase: ASExprList) {
    const head = matchCase.elements[0];
    return head.tag === "symbol" && head.name === ":default";
  }

  const lastCaseForm = caseForms.length > 0 && last(caseForms)!;
  if (
    lastCaseForm &&
    lastCaseForm.tag === "list" &&
    isDefaultCase(lastCaseForm)
  ) {
    defaultCaseForm = lastCaseForm;
    caseForms = caseForms.slice(0, -1);
  }

  //
  // c is expected to be a pattern case like ({label: variable} ...forms...)
  //
  function convertMatchPatternCase(c: ASExprList) {
    const [pattern, ...bodyForms] = c.elements;

    if (pattern.tag !== "map") {
      errors.push(`The pattern must be a map`);
      return null;
    }

    let record: ParseRecordResult;

    try {
      record = parseRecord(pattern);
    } catch (err) {
      errors.push(`ill-formatted pattern`);
      return null;
    }

    if (record.tail !== undefined) {
      errors.push(`The pattern must be a map`);
      return null;
    }

    if (record.fields.length !== 1) {
      errors.push(`Expected a single field`);
      return null;
    }

    const variableSymbol = record.fields[0].value;
    if (variableSymbol.tag !== "symbol") {
      errors.push(`Expected a variable`);
      return null;
    }

    const label = record.fields[0].label.name;

    return {
      label,
      variable: parseIdentifier(variableSymbol),
      body: parseBody(c, bodyForms),
    };
  }

  const cases = maybeMap<ASExpr, S.SMatchCaseF<S.Expression<WithErrors>>>(
    (c) => {
      if (c.tag !== "list") {
        errors.push("invalid pattern");
        return null;
      }
      return convertMatchPatternCase(c);
    },
    caseForms
  );

  const defaultCase =
    defaultCaseForm &&
    parseBody(defaultCaseForm, defaultCaseForm.elements.slice(1));

  return result(
    {
      tag: "match",
      value,
      cases,
      defaultCase,
    },
    whole.location,
    errors
  );
});

defineConversion("case", (case_, args, whole) => {
  if (args.length > 2 || args.length < 1) {
    throw new ConvertError(
      printHighlightedExpr(
        "Expected a keyword an maybe a value",
        case_.location
      )
    );
  }

  const [labelForm, valueForm] = args;

  if (labelForm.tag !== "symbol" || !labelForm.name.startsWith(":")) {
    throw new ConvertError(`Invalid tag!`);
  }

  const label = labelForm.name;
  const value = valueForm ? convertExpr(valueForm) : undefined;

  return result(
    {
      tag: "case",
      label,
      value,
    },
    whole.location,
    []
  );
});

defineConversion("values", (_values, args, whole) => {
  return result(
    { tag: "values", values: args.map(convertExpr) },
    whole.location,
    []
  );
});

defineConversion("multiple-value-bind", (_mvbind, args, whole) => {
  if (args.length < 3) {
    throw new ConvertError(
      printHighlightedExpr(
        `Ill-formed form.

(multiple-value-bind (variable1 variable2 ...)
    form
  ...body)`,
        whole.location
      )
    );
  }

  const [variables, form, ...body] = args;

  if (variables.tag !== "list") {
    throw new ConvertError(
      printHighlightedExpr(`Expected a list of variables`, variables.location)
    );
  }

  variables.elements.forEach((v) => {
    if (v.tag !== "symbol") {
      throw new ConvertError(
        printHighlightedExpr(`Expected an identifier`, v.location)
      );
    }
  });

  return result(
    {
      tag: "multiple-value-bind",
      variables: variables.elements.map((v) =>
        parseIdentifier(v as ASExprSymbol)
      ),
      form: convertExpr(form),
      body: parseBody(whole, body),
    },
    whole.location,
    []
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
      value: convertExpr(value),
    },
    location: whole.location,
    info: {
      errors: [],
    },
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

  const [spec] = args;

  if (spec.tag === "symbol") {
    return {
      node: {
        tag: "export",
        identifiers: [parseIdentifier(spec)],
      },
      location: whole.location,
      info: {
        errors: [],
      },
    };
  } else if (spec.tag === "vector") {
    spec.elements.forEach((spec) => {
      if (spec.tag !== "symbol") {
        throw new ConvertError(
          printHighlightedExpr(
            "'export' expected a symbol of vector of symbols",
            spec.location
          )
        );
      }
    });

    const symbols = spec.elements as ASExprSymbol[];

    return {
      node: {
        tag: "export",
        identifiers: symbols.map(parseIdentifier),
      },
      location: whole.location,
      info: {
        errors: [],
      },
    };
  } else {
    throw new ConvertError(
      printHighlightedExpr(
        "'export' expected a symbol of vector of symbols",
        spec.location
      )
    );
  }
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

  const definitionType = convertType(definition).noWildcards();

  if (listTypeVariables(definitionType).length > 0) {
    throw new ConvertError(
      printHighlightedExpr("Type variable out of scope", definition.location)
    );
  }

  return {
    node: {
      tag: "type-alias",
      alias: parseIdentifier(name),
      definition: definitionType,
    },
    location: whole.location,
    info: {
      errors: [],
    },
  };
});

defineToplevel("import", (import_, args, whole) => {
  if (args.length !== 3) {
    const lastExpr = last([import_, ...args]) as ASExpr;
    throw new ConvertError(
      printHighlightedExpr(
        `'import' needs exactly 3 arguments, got ${args.length}`,
        lastExpr.location,
        true
      )
    );
  }

  const [name, from_, source] = args;

  if (name.tag !== "symbol") {
    throw new ConvertError(
      printHighlightedExpr("'type' expected a symbol as a name", name.location)
    );
  }

  if (!(from_.tag === "symbol" && from_.name === ":from")) {
    throw new ConvertError(
      printHighlightedExpr("Expected :FROM keyword.", from_.location)
    );
  }

  if (source.tag !== "string") {
    throw new ConvertError(
      printHighlightedExpr(
        "Source of an import should be specified as a string",
        from_.location
      )
    );
  }

  return {
    node: {
      tag: "import",
      variable: parseIdentifier(name),
      source: source.value,
    },
    location: whole.location,
    info: {
      errors: [],
    },
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
    return successFrom(list, {
      tag: "function-call",
      fn: convertExpr(fn),
      arguments: args.map(convertExpr),
    });
  }
}

function convertVector(list: ASExprVector): ExpressionWithErrors {
  return successFrom(list, {
    tag: "vector",
    values: list.elements.map(convertExpr),
  });
}

function convertMap(map: ASExprMap): ExpressionWithErrors {
  const { fields, tail } = parseRecord(map);
  return successFrom(map, {
    tag: "record",
    fields: fields.map((f) => ({
      label: parseIdentifier(f.label),
      value: convertExpr(f.value),
    })),
    source: tail && {
      extending: (() => {
        switch (tail.separator.name) {
          case "<|":
            return true;
          case "|":
            return false;
          default:
            throw new ConvertError(
              `Invalid record separator ${tail.separator.name}`
            );
        }
      })(),
      expression: convertExpr(tail.expression),
    },
  });
}

function parseIdentifier(expr: ASExprSymbol): S.Identifier {
  return {
    tag: "identifier",
    name: expr.name,
    location: expr.location,
  };
}

function convertSymbol(expr: ASExprSymbol): ExpressionWithErrors {
  switch (expr.name) {
    case "true":
      return result({ tag: "boolean", value: true }, expr.location, []);
    case "false":
      return result({ tag: "boolean", value: false }, expr.location, []);
    case "none":
      return result({ tag: "none" }, expr.location, []);
    default: {
      const id = parseIdentifier(expr);
      return result(
        {
          tag: "variable-reference",
          name: id.name,
        },
        id.location,
        []
      );
    }
  }
}

function convertExprOrError(expr: ASExpr): ExpressionWithErrors {
  switch (expr.tag) {
    case "number":
      return successFrom(expr, { tag: "number", value: expr.value });
    case "string":
      return successFrom(expr, { tag: "string", value: expr.value });
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

export function convertExpr(expr: ASExpr): ExpressionWithErrors {
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
  return foldExpr(expr, (e) => [
    ...e.info.errors,
    ...flatten(exprFChildren(e)),
  ]);
}

export function collectConvertErrors(syntax: SyntaxWithErrors): string[] {
  if (S.isExpression(syntax)) {
    return collectConvertExprErrors(syntax);
  } else {
    switch (syntax.node.tag) {
      case "import":
      case "export":
      case "type-alias":
        return syntax.info.errors;
      case "definition":
        return [
          ...syntax.info.errors,
          ...collectConvertExprErrors(syntax.node.value),
        ];
      default:
        return assertNever(syntax.node);
    }
  }
}

export function createImportSyntax(
  name: string,
  source: string
): S.SImport<WithErrors> {
  return {
    node: {
      tag: "import",
      variable: {
        tag: "identifier",
        name,
        location: nolocation,
      },
      source,
    },
    info: {
      errors: [],
    },
    location: nolocation,
  };
}

export function readSyntax(source: string) {
  return convert(readFromString(source));
}

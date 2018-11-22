//
// reader.ts --- The reader for Deisp
//

//
// S-Expression parser
//

import {
  Parser,
  regex,
  alternatives,
  many,
  delimited,
  getParserError
} from "./parser-combinators";

import { ASExpr } from "./syntax";

const spaces = regex(/^\s*/);

function spaced<A>(x: Parser<A>) {
  return delimited(spaces, x, spaces);
}

//
// Number
//
const number: Parser<ASExpr> = regex(/-?[0-9]+/)
  .map(
    (string, location): ASExpr => ({
      type: "number",
      value: parseInt(string, 10),
      location
    })
  )
  .description("number");

//
// String
//
const doubleQuote = regex(/"/).description("double quote");

const stringChar = regex(/[^"\\]/).description("non-escaped string character");

const stringEscapedChar = regex(/\\[n\\]/)
  .map(escaped => {
    const ch = escaped[1];
    switch (ch) {
      case "n":
        return "\n";
      case "\\":
        return "\\";
      default:
        return ch;
    }
  })
  .description("escaped string character");

const stringConstituent = alternatives(stringChar, stringEscapedChar);

const string = delimited(doubleQuote, many(stringConstituent), doubleQuote)
  .map(
    (chars, location): ASExpr => ({
      type: "string",
      value: chars.join(""),
      location
    })
  )
  .description("string");

//
// Symbol
//

const symbol: Parser<ASExpr> = regex(/[a-zA-Z+<>!@$%^*/-]+/)
  .map(
    (name, location): ASExpr => ({
      type: "symbol",
      name,
      location
    })
  )
  .description("symbol");

//
// Lists & S-Expressions
//

const atom: Parser<ASExpr> = alternatives(number, string, symbol).description(
  "atom"
);

const leftParen = regex(/\(/).description("open parenthesis");
const rightParen = regex(/\)/).description("close parenthesis");

function list(x: Parser<ASExpr>): Parser<ASExpr> {
  return delimited(leftParen, many(x), spaces.then(rightParen))
    .map(
      (elements, location): ASExpr => ({
        type: "list",
        elements,
        location
      })
    )
    .description("list");
}

const reportUnmatched: Parser<{}> = Parser.lookahead(rightParen).chain(
  closed => {
    if (closed) {
      return Parser.fail("Unmatched closed parenthesis");
    } else {
      return Parser.of({});
    }
  }
);

const sexpr: Parser<ASExpr> = spaced(
  reportUnmatched.then(atom.or(() => list(sexpr)))
);

//
// Parser a Delisp expression from a string
//
export function readFromString(str: string) {
  const result = sexpr.parse(str);
  if (result.status === "success") {
    return result.value;
  } else {
    const message = getParserError(str, result);
    throw new Error(message);
  }
}

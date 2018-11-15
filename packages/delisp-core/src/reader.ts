//
// reader.ts --- The reader for Delisp
//

// import { List, Syntax } from "./syntax";

//
// S-Expression parser
//

import {
  Parser,
  regex,
  alternatives,
  many,
  delimited
} from "./parser-combinators";

import { ASExpr } from "./syntax";

const spaces = regex(/^\s*/);

function spaced<A>(x: Parser<A>) {
  return delimited(spaces, x, spaces);
}

const number: Parser<ASExpr> = regex(/[0-9]+/)
  .map(
    (string, location): ASExpr => ({
      type: "number",
      value: parseInt(string, 10),
      location
    })
  )
  .description("number");

const doubleQuote = regex(/"/).description("double quote");

const stringChar = regex(/[^"\\]/).description("non-escaped string character");
const stringEscapedChar = regex(/\\[n\\]/).description(
  "escaped string character"
);
const stringConsitutent = alternatives(stringChar, stringEscapedChar);

const string = doubleQuote
  .then(many(stringConsitutent))
  .skip(doubleQuote)
  .map(
    (chars, location): ASExpr => ({
      type: "string",
      value: chars.join(""),
      location
    })
  );

const symbol: Parser<ASExpr> = regex(/[a-zA-Z+<>!@$%^*/-]+/)
  .map(
    (name, location): ASExpr => ({
      type: "symbol",
      name,
      location
    })
  )
  .description("symbol");

const atom: Parser<ASExpr> = alternatives(number, string, symbol).description(
  "atom"
);

const leftParen = regex(/\(/).description("open parenthesis");
const rightParen = regex(/\)/).description("close parenthesis");

function list(x: Parser<ASExpr>): Parser<ASExpr> {
  return leftParen
    .then(many(x))
    .skip(spaces)
    .skip(rightParen)
    .map(
      (elements, location): ASExpr => ({
        type: "list",
        elements,
        location
      })
    );
}

const sexpr: Parser<ASExpr> = spaced(atom.or(() => list(sexpr)));

//
// Parser a Delisp expression from a string
//
export function readFromString(str: string) {
  return sexpr.parse(str);
}

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

type SExpr = number | string | SExprList;
interface SExprList extends Array<SExpr> {}

const spaces = regex(/^\s*/);

function spaced<A>(x: Parser<A>) {
  return delimited(spaces, x, spaces);
}

const number: Parser<SExpr> = regex(/[0-9]+/)
  .map(x => parseInt(x, 10))
  .description("number");

// const doubleQuote = regex(/"/).description("double quote");
//
// const stringChar = regex(/[^"\\]/).description("non-escaped string character");
// const stringEscapedChar = regex(/\\[n\\]/).description(
//   "escaped string character"
// );

const symbol: Parser<SExpr> = regex(/[a-zA-Z+<>!@$%^*/-]+/).description(
  "symbol"
);

const atom: Parser<SExpr> = alternatives(number, symbol).description("atom");

const leftParen = regex(/\(/).description("open parenthesis");
const rightParen = regex(/\)/).description("close parenthesis");

function list<A>(x: Parser<A>) {
  return spaced(leftParen)
    .then(many(x))
    .skip(spaced(rightParen));
}

const sexpr: Parser<SExpr> = spaced(atom.or(() => list(sexpr)));

//
// Parser a Delisp expression from a string
//
export function readFromString(str: string) {
  return sexpr.parse(str);
}

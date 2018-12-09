//
// reader.ts --- The reader for Deisp
//

//
// S-Expression parser
//

import {
  alternatives,
  atLeastOne,
  character,
  delimited,
  delimitedMany,
  endOfInput,
  many,
  Parser,
  until
} from "./parser-combinators";

import { ASExpr } from "./sexpr";

const spaces = many(
  alternatives(character(" "), character("\t"), character("\n"))
);

function spaced<A>(x: Parser<A>) {
  return delimited(spaces, x, spaces);
}

const alphanumeric = character().chain(char => {
  if (/[a-zA-Z0-9]/.test(char)) {
    return Parser.of(char);
  } else {
    return Parser.fail("an alphanumeric character");
  }
});

const digit = character().chain(char => {
  if (/[0-9]/.test(char)) {
    return Parser.of(char);
  } else {
    return Parser.fail("a digit");
  }
});

//
// Number
//

const unsignedInteger: Parser<number> = atLeastOne(digit).map(digits =>
  parseInt(digits.join(""), 10)
);
const negativeInteger: Parser<number> = character("-")
  .chain(_ => unsignedInteger)
  .map(num => -num);

const numberP: Parser<ASExpr> = alternatives(negativeInteger, unsignedInteger)
  .map(
    (val, location): ASExpr => ({
      type: "number",
      value: val,
      location
    })
  )
  .description("number");

//
// String
//
const doubleQuote = character('"').description("double quote");

const stringChar = character()
  .chain(char => {
    if (char === '"') {
      return Parser.fail("Not inside string");
    }
    if (char === "\\") {
      return alternatives(
        character("n").map(_ => "\n"),
        character("\\")
      ).description("escaped string character");
    }
    return Parser.of(char);
  })
  .description("string character");

const stringP = delimitedMany(doubleQuote, stringChar, doubleQuote)
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

const symbol: Parser<ASExpr> = atLeastOne(
  alternatives(
    alphanumeric,
    character("!"),
    character("@"),
    character("#"),
    character("$"),
    character("%"),
    character("^"),
    character("&"),
    character("*"),
    character("<"),
    character(">"),
    character("+"),
    character("-"),
    character("/"),
    character("~"),
    character("?")
  )
)
  .map(
    (chars, location): ASExpr => ({
      type: "symbol",
      name: chars.join(""),
      location
    })
  )
  .description("symbol");

//
// Lists & S-Expressions
//

const atom: Parser<ASExpr> = alternatives(numberP, stringP, symbol).description(
  "atom"
);

const leftParen = character("(").description("open parenthesis");
const rightParen = character(")").description("close parenthesis");

function list(x: Parser<ASExpr>): Parser<ASExpr> {
  return delimitedMany(leftParen, x, spaces.then(rightParen))
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

const sexprs: Parser<ASExpr[]> = until(endOfInput, sexpr);

export function readAllFromString(str: string): ASExpr[] {
  return sexprs.parse(str);
}

//
// Parser a Delisp expression from a string
//
export function readFromString(str: string): ASExpr {
  return sexpr.parse(str);
}

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
  lazy,
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
    // Those special characters are valid in Delisp symbols.
    //
    // If you want to change this list, please remmeber checking the
    // compiler and ensuring that it is able to generate JS variables
    // for those names.
    character("!"),
    character("#"),
    character("$"),
    character("%"),
    character("^"),
    character("&"),
    character("."),
    character("*"),
    character("<"),
    character(">"),
    character("+"),
    character("-"),
    character("/"),
    character("~"),
    character("?"),
    character("=")
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

const leftBracket = character("[").description("open square bracket");
const rightBracket = character("]").description("close square bracket");

function vector(x: Parser<ASExpr>): Parser<ASExpr> {
  return delimitedMany(leftBracket, x, spaces.then(rightBracket))
    .map(
      (elements, location): ASExpr => ({
        type: "vector",
        elements,
        location
      })
    )
    .description("vector");
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

const leftCurly = character("{").description("open curly brace");
const rightCurly = character("}").description("close curly brace");

const atExprBodyConstitutent: Parser<ASExpr> = lazy(() => {
  return atExpr.or(
    many(
      character().chain(x => {
        if (x === "}" || x === "@") {
          return Parser.fail(`${x} is not a valid character in {...}`);
        }
        return Parser.of(x);
      })
    ).map(
      (chars, location): ASExpr => ({
        type: "string",
        value: chars.join(""),
        location
      })
    )
  );
});

const atExprBody: Parser<ASExpr[]> = delimitedMany(
  leftCurly,
  atExprBodyConstitutent,
  rightCurly
);

const atExpr = lazy(() => {
  return character("@").chain((_, location) => {
    return sexpr.chain(headValue => {
      return atExprBody.map(
        (bodyValue): ASExpr => ({
          type: "list",
          elements: [headValue, ...bodyValue],
          location
        })
      );
    });
  });
});

const sexpr: Parser<ASExpr> = spaced(
  lazy(() =>
    reportUnmatched.then(alternatives(atom, atExpr, list(sexpr), vector(sexpr)))
  )
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

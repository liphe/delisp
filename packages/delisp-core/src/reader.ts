//
// reader.ts --- The reader for Delisp
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
  until,
} from "./parser-combinators";
import {
  ASExpr,
  ASExprMap,
  ASExprNumber,
  ASExprString,
  ASExprSymbol,
} from "./sexpr";

const spaces = many(
  alternatives(character(" "), character("\t"), character("\n"))
);

function spaced<A>(x: Parser<A>) {
  return delimited(spaces, x, spaces);
}

const alphanumeric = character().chain((char) => {
  if (/[a-zA-Z0-9α-ω]/.test(char)) {
    return Parser.of(char);
  } else {
    return Parser.fail("an alphanumeric character");
  }
});

// Those special characters are valid in Delisp symbols.
//
// If you want to change this list, please remmeber checking the
// compiler and ensuring that it is able to generate JS variables
// for those names.
const specialChar = alternatives(
  // character("`"),
  character("~"),
  character("!"),
  // @ is used for at-expressions
  character("#"),
  character("$"),
  character("%"),
  character("^"),
  character("&"),
  character("*"),
  // ( and ) are used for lists
  character("-"),
  character("_"),
  character("="),
  character("+"),
  // [ and ] are used for vectors
  // { and } are used for maps
  // \ is used for escaping strings
  character("|"),
  // character(";"),
  character(":"),
  // character("'"),
  // character(","),
  character("<"),
  character("."),
  character(">"),
  character("/"),
  character("?")
);

//
// String
//
const doubleQuote = character('"').description("double quote");

const stringChar = character()
  .chain((char) => {
    if (char === '"') {
      return Parser.fail("Not inside string");
    }
    if (char === "\\") {
      return alternatives(
        character("n").map((_) => "\n"),
        character("\\")
      ).description("escaped string character");
    }
    return Parser.of(char);
  })
  .description("string character");

const stringP: Parser<ASExprString> = delimitedMany(
  doubleQuote,
  stringChar,
  doubleQuote
)
  .map(
    (chars, location): ASExprString => ({
      tag: "string",
      value: chars.join(""),
      location,
    })
  )
  .description("string");

//
// Symbol
//

const symbol: Parser<ASExprSymbol> = atLeastOne(
  alternatives(alphanumeric, specialChar)
).map(
  (chars, location): ASExprSymbol => ({
    tag: "symbol",
    name: chars.join(""),
    location,
  })
);

//
// Symbol or Number
//

const numberOrSymbol: Parser<ASExprSymbol | ASExprNumber> = atLeastOne(
  alternatives(alphanumeric, specialChar)
)
  .map((chars, location): ASExprSymbol | ASExprNumber => {
    const str = chars.join("");
    if (/^\-?[0-9]+(\.[0-9]+)?$/.test(str)) {
      return {
        tag: "number",
        value: parseFloat(str),
        location,
      };
    } else {
      return {
        tag: "symbol",
        name: str,
        location,
      };
    }
  })
  .description("number or symbol");

//
// Lists & S-Expressions
//

const atom: Parser<ASExpr> = alternatives<ASExpr>(
  numberOrSymbol,
  stringP
).description("atom");

const leftParen = character("(").description("open parenthesis");
const rightParen = character(")").description("close parenthesis");

function list(x: Parser<ASExpr>): Parser<ASExpr> {
  return delimitedMany(leftParen, x, spaces.then(rightParen))
    .map(
      (elements, location): ASExpr => ({
        tag: "list",
        elements,
        location,
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
        tag: "vector",
        elements,
        location,
      })
    )
    .description("vector");
}

const reportUnmatched: Parser<{}> = Parser.lookahead(rightParen).chain(
  (closed) => {
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
      character().chain((x) => {
        if (x === "}" || x === "@") {
          return Parser.fail(`${x} is not a valid character in {...}`);
        }
        return Parser.of(x);
      })
    ).chain(
      (chars, location): Parser<ASExpr> => {
        if (chars.length === 0) {
          return Parser.fail(`empty body`);
        }
        return Parser.of({
          tag: "string",
          value: chars.join(""),
          location,
        });
      }
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
    // @{...}
    const simpleForm = atExprBody.map(
      (bodyValue): ASExpr => ({
        tag: "list",
        elements: [
          {
            tag: "symbol",
            name: "comment",
            location,
          },
          ...bodyValue,
        ],
        location,
      })
    );

    const fullForm = sexpr.chain((headValue) => {
      return atExprBody.map(
        (bodyValue): ASExpr => ({
          tag: "list",
          elements: [headValue, ...bodyValue],
          location,
        })
      );
    });

    return alternatives(simpleForm, fullForm);
  });
});

const mapFields = (
  x: Parser<ASExpr>
): Parser<{ label: ASExprSymbol; value: ASExpr }> =>
  spaced(symbol).chain((label) => {
    return x.chain((value) => {
      return Parser.of({
        label,
        value,
      });
    });
  });

const mapP = (x: Parser<ASExpr>): Parser<ASExpr> =>
  delimitedMany(leftCurly, mapFields(x), rightCurly).map(
    (fields, location): ASExprMap => ({
      tag: "map",
      fields,
      location,
    })
  );

const sexpr: Parser<ASExpr> = spaced(
  lazy(() =>
    reportUnmatched.then(
      alternatives(atom, atExpr, list(sexpr), vector(sexpr), mapP(sexpr))
    )
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

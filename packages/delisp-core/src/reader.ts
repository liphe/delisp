//
// reader.ts --- The reader for Delisp
//

// import { List, Syntax } from "./syntax";

export interface Location {
  offset: number;
}

class Input {
  private input: string;
  private offset: number;

  constructor(input: string, offset: number = 0) {
    this.input = input;
    this.offset = offset;
  }

  readChar(): [string | null, Input] {
    if (this.offset >= this.input.length) {
      throw new Error(`End of file`);
    } else {
      return [this.input[this.offset], new Input(this.input, this.offset + 1)];
    }
  }

  readChars(n: number): [string, Input] {
    return [
      this.input.slice(this.offset, this.offset + n),
      new Input(this.input, this.offset + n)
    ];
  }

  toString() {
    return this.input.slice(this.offset);
  }

  location(): Location {
    return { offset: this.offset };
  }
}

// `Parser` implements a parsers with a monadic interface.
//
// A parser will produce a `ParserResult` of of a given type, or it
// will fail. Failed parsers should return information about what they
// expected to parse to facilitate generating friendly error messages.
//

type ParserResult<A> = ParserSuccess<A> | ParserError;

interface ParserSuccess<A> {
  status: "success";
  value: A;
  moreInput: Input;
}

interface ParserError {
  status: "error";
  expected?: string;
  reasons: ParserError[];
}

class Parser<A> {
  run: (input: Input) => ParserResult<A>;

  constructor(fn: (input: Input) => ParserResult<A>) {
    this.run = fn;
  }

  static of<A>(value: A) {
    return new Parser(moreInput => {
      const result: ParserSuccess<A> = { status: "success", value, moreInput };
      return result;
    });
  }

  description(desc: string) {
    return new Parser(input => {
      const result = this.run(input);
      if (result.status === "success") {
        return result;
      } else {
        return {
          status: "error",
          expected: desc,
          reasons: [result]
        };
      }
    });
  }

  chain<B>(fn: (value: A) => Parser<B>) {
    return new Parser<B>((input: Input) => {
      const result = this.run(input);
      if (result.status !== "success") {
        return result;
      }
      const { value, moreInput } = result;
      return fn(value).run(moreInput);
    });
  }

  then<B>(p: Parser<B>): Parser<B> {
    return this.chain(_ => p);
  }

  skip(p: Parser<unknown>): Parser<A> {
    return this.chain(x => p.map(_ignored => x));
  }

  or(makeAlternative: () => Parser<A>) {
    return new Parser((input: Input) => {
      // Try the current parser
      const result = this.run(input);
      if (result.status === "success") {
        return result;
      }
      // Try the alternative parser
      const alternativeResult = makeAlternative().run(input);
      if (alternativeResult.status === "success") {
        return alternativeResult;
      }
      // If both failed, keep track of expected values so we can come
      // back to them later!
      return {
        status: "error",
        reasons: [...result.reasons, ...alternativeResult.reasons]
      };
    });
  }

  map<B>(f: (x: A) => B): Parser<B> {
    return this.chain(a => Parser.of(f(a)));
  }
}

function alternatives<A>(...alternatives: Parser<A>[]) {
  return alternatives.reduce((p1, p2) => p1.or(() => p2));
}

function delimited<A>(
  left: Parser<unknown>,
  p: Parser<A>,
  right: Parser<unknown>
) {
  return left.then(p).skip(right);
}

function many<A>(parser: Parser<A>): Parser<A[]> {
  return parser
    .chain(first => {
      return many(parser).map(rest => [first, ...rest]);
    })
    .or(() => Parser.of([]));
}

// The reader is organized in 3 layers of parsing:
//
// - Lexical level
// - S-Expression level
// - Syntactic level
//

//
// Lexical parsing
//

function flags(re: RegExp) {
  var s = "" + re;
  return s.slice(s.lastIndexOf("/") + 1);
}

function anchoredRegexp(re: RegExp) {
  return RegExp("^(?:" + re.source + ")", flags(re));
}

const regex = (regex: RegExp) => {
  const anchored = anchoredRegexp(regex);
  return new Parser<string>(input => {
    const match = anchored.exec(input.toString());

    if (match === null) {
      return {
        status: "error",
        expected: `match for ${regex}`,
        reasons: []
      };
    }

    const value = match[0];
    const [, moreInput] = input.readChars(value.length);
    return {
      status: "success",
      value,
      moreInput
    };
  });
};

//
// S-Expression parser
//

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
  return leftParen.then(many(x)).skip(rightParen);
}

const sexpr: Parser<SExpr> = spaced(atom.or(() => list(sexpr)));

//
// Parser a Delisp expression from a string
//
export function readFromString(str: string) {
  const input = new Input(str);
  return sexpr.run(input);
}

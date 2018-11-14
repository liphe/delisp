// `Parser` implements a parsers with a monadic interface.
//
// A parser will produce a `ParserResult` of of a given type, or it
// will fail. Failed parsers should return information about what they
// expected to parse to facilitate generating friendly error messages.
//

export interface Location {
  start: number;
  end: number;
}

class Input {
  private input: string;
  readonly offset: number;

  constructor(input: string, offset: number = 0) {
    this.input = input;
    this.offset = offset;
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
}

export type ParserResult<A> = ParserSuccess<A> | ParserError;

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

export class Parser<A> {
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

  chain<B>(fn: (value: A, location: Location) => Parser<B>) {
    return new Parser<B>((input: Input) => {
      const result = this.run(input);
      if (result.status !== "success") {
        return result;
      }
      const { value, moreInput } = result;

      const location: Location = {
        start: input.offset,
        end: moreInput.offset
      };

      return fn(value, location).run(moreInput);
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
        reasons: [result, alternativeResult]
      };
    });
  }

  map<B>(f: (x: A, loc: Location) => B): Parser<B> {
    return this.chain((a, location) => Parser.of(f(a, location)));
  }

  //
  // Run a parser against a string
  //
  parse(x: string) {
    const input = new Input(x);
    return this.run(input);
  }
}

export function alternatives<A>(...alternatives: Parser<A>[]) {
  return alternatives.reduce((p1, p2) => p1.or(() => p2));
}

export function delimited<A>(
  left: Parser<unknown>,
  p: Parser<A>,
  right: Parser<unknown>
) {
  return left.then(p).skip(right);
}

export function many<A>(parser: Parser<A>): Parser<A[]> {
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

export const regex = (regex: RegExp) => {
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

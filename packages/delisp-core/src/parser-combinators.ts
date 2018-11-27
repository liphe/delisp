/** `Parser` implements a parsers with a monadic interface.
 *
 * A parser will produce a `ParserResult` of of a given type, or it
 * will fail. Failed parsers should return information about what they
 * expected to parse to facilitate generating friendly error messages.
 */

import { printHighlightedSource } from "./error-report";
import { Input, Offset, Location } from "./input";

export type ParserResult<A> = ParserSuccess<A> | ParserError;

interface ParserSuccess<A> {
  status: "success";
  value: A;
  moreInput: Input;
}

interface ParserError {
  status: "error";
  expected?: string;
  incomplete: boolean;
  reasons: ParserError[];
  offset: Offset;
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

  static fail(message: string): Parser<never> {
    return new Parser(input => ({
      status: "error",
      expected: message,
      incomplete: false,
      reasons: [],
      offset: input.offset
    }));
  }

  static lookahead(parser: Parser<unknown>): Parser<boolean> {
    return new Parser(input => {
      const result = parser.run(input);
      return {
        status: "success",
        value: result.status === "success",
        moreInput: input
      };
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
          incomplete: result.incomplete,
          reasons: [result],
          offset: input.offset
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
        input,
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

  or(makeAlternative: (err: ParserError) => Parser<A>) {
    return new Parser((input: Input) => {
      // Try the current parser
      const result = this.run(input);
      if (result.status === "success") {
        return result;
      }
      // Try the alternative parser
      const alternativeResult = makeAlternative(result).run(input);
      if (alternativeResult.status === "success") {
        return alternativeResult;
      }
      // If both failed, keep track of expected values so we can come
      // back to them later!
      return {
        status: "error",
        reasons: [result, alternativeResult],
        incomplete: result.incomplete || alternativeResult.incomplete,
        offset: input.offset
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

export function until<A>(
  delimiter: Parser<unknown>,
  parser: Parser<A>
): Parser<A[]> {
  return delimiter.map(_ => [] as A[]).or(err => {
    return parser.chain(first => {
      return until(delimiter, parser).map(rest => [first, ...rest]);
    });
  });
}

export function delimitedMany<A>(
  left: Parser<unknown>,
  p: Parser<A>,
  right: Parser<unknown>
): Parser<A[]> {
  return left.then(until(right, p));
}

export function many<A>(parser: Parser<A>): Parser<A[]> {
  // NOTE: many(x) parser will always succeed, although possibly with
  // an empty array as a result. This is not great for error
  // reporting, as having another instance of `x` is not considered in
  // the errors. For instance, `(1 2 3_` will report as 'expected
  // right parenthesis', but it will forget that more list elements
  // could be accepted.'
  //
  // It would be better to combine `delimited` and `many` into a
  // single operator that take care of this.
  return parser
    .chain(first => {
      return many(parser).map(rest => [first, ...rest]);
    })
    .or(() => Parser.of([]));
}

export function atLeastOne<A>(parser: Parser<A>): Parser<A[]> {
  return parser.chain(first => many(parser).map(rest => [first, ...rest]));
}

//
// Primitive parsers
//

export const character = (expected?: string) => {
  return new Parser<string>(input => {
    const [char, moreInput] = input.readChars(1);

    if (char === "") {
      return {
        status: "error",
        reasons: [],
        incomplete: true,
        offset: input.offset
      };
    }

    if (typeof expected !== "undefined" && char !== expected) {
      return {
        status: "error",
        reasons: [],
        incomplete: false,
        offset: input.offset
      };
    }

    return {
      status: "success",
      value: char,
      reasons: [],
      moreInput
    };
  });
};

//
// Error reporting
//

/** Get a user-friendly error message for a parser error */
export function getParserError(source: string, error: ParserError): string {
  //
  // A ParseError contains a tree of errors as returned by a parser
  // and its dependencies. Leaves in this tree are where the errors
  // were triggered.
  //
  // Of course, we don't know what the user intended to write, but we
  // can think of one each of the paths (or leaves) in this tree as
  // candidates.
  //
  // We'll use the heuristic of picking the leave with the highest
  // offset. This works under the assumption that errors happen late
  // in the input. For example, if we find
  //
  //    (1 2 3 4"
  //
  // We'll identify this as a incomplete list, instead of a string
  // with a mistyped string "1 2 3 4". In case of tie, we'll include
  // the different alternatives in the error message.
  //
  // We'll see how this works in practice.
  //

  // Calculate the maximum offset within the descendants of ParserError
  function maxOffset(error: ParserError): Offset {
    return Math.max(error.offset, ...error.reasons.map(maxOffset));
  }

  // Remove subtrees with a maximum offset smaller than offset.
  function pruneErrorTree(
    error: ParserError,
    offset: Offset
  ): ParserError | null {
    if (maxOffset(error) < offset) {
      return null;
    } else {
      return {
        ...error,
        reasons: error.reasons
          .map(subtree => pruneErrorTree(subtree, offset))
          .filter((x: ParserError | null): x is ParserError => x !== null)
      };
    }
  }

  // Map leaves of the tree to an array of errors. The function to map
  // will receive the leave node and the list of ascendant nodes as
  // well.
  function mapLeaves<A>(
    error: ParserError,
    fn: (error: ParserError, parents: ParserError[]) => A,
    parents: ParserError[] = []
  ): A[] {
    if (error.reasons.length === 0) {
      return [fn(error, parents)];
    } else {
      return error.reasons
        .map(e => mapLeaves(e, fn, [e, ...parents]))
        .reduce((x, y) => [...x, ...y], []);
    }
  }

  // Process the error tree
  const offset = maxOffset(error);
  const prunedTree = pruneErrorTree(error, offset);
  if (prunedTree === null) {
    throw new Error(
      `Assertion failed. A tree pruned to its maximum offset should not be empty.`
    );
  }

  const errors = mapLeaves(prunedTree, (error, parents) => {
    return (
      [error, ...parents].find(e => e.expected !== undefined) || {
        ...error,
        expected: "Parsing error"
      }
    );
  });

  const uniqueErrors = [...new Set(errors)];

  const expected = uniqueErrors
    .map(
      (err, i) =>
        i > 0 && i === uniqueErrors.length - 1
          ? `or ${err.expected}`
          : err.expected
    )
    .join(", ");

  const message = `Expected ${expected}`;

  return printHighlightedSource(message, source, offset);
}

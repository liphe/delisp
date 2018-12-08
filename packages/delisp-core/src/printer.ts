import {
  concat,
  Doc,
  group,
  align,
  join,
  line,
  nest,
  pretty,
  text
} from "./prettier";
import { Expression, Syntax } from "./syntax";

function printString(str: string): Doc {
  const escaped = str.replace(/\n/g, "\\n").replace(/"/g, '\\"');
  return text(`"${escaped}"`);
}

function printVariable(name: string): Doc {
  return text(name);
}

function print(sexpr: Syntax): Doc {
  switch (sexpr.type) {
    case "string":
      return printString(sexpr.value);
    case "number":
      return text(String(sexpr.value));
    case "variable-reference":
      return printVariable(sexpr.variable);
    case "function":
      return group(
        concat(
          text("(lambda"),
          text(" "),
          text("("),
          group(
            join(
              sexpr.lambdaList.map(x => x.variable).map(printVariable),
              nest(9, line)
            )
          ),
          text(")"),
          nest(2, concat(line, print(sexpr.body))),
          text(")")
        )
      );
    case "function-call":
      const fn = print(sexpr.fn);
      return group(
        concat(
          text("("),
          fn,
          text(" "),
          align(...sexpr.args.map(print)),
          text(")")
        )
      );
    case "definition":
      return group(
        concat(
          text("(define"),
          text(" "),
          printVariable(sexpr.variable),
          nest(2, concat(line, print(sexpr.value))),
          text(")")
        )
      );
  }
}

export function pprint(sexpr: Syntax, lineWidth: number): string {
  return pretty(print(sexpr), lineWidth);
}

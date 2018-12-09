import {
  align,
  concat,
  Doc,
  group,
  groupalign,
  indent as indent_,
  join,
  line,
  pretty,
  text
} from "./prettier";
import { Expression, Syntax } from "./syntax";

function indent(x: Doc, level = 2): Doc {
  return indent_(x, level);
}

function printString(str: string): Doc {
  const escaped = str.replace(/\n/g, "\\n").replace(/"/g, '\\"');
  return text(`"${escaped}"`);
}

function printVariable(name: string): Doc {
  return text(name);
}

const lparen = text("(");
const rparen = text(")");
const space = text(" ");

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
          lparen,
          text("lambda"),
          space,
          lparen,
          group(
            align(...sexpr.lambdaList.map(x => x.variable).map(printVariable))
          ),
          rparen,
          indent(concat(line, print(sexpr.body))),
          rparen
        )
      );
    case "function-call":
      const fn = print(sexpr.fn);
      const args = sexpr.args.map(print);
      return group(
        concat(text("("), groupalign(fn, align(...args)), text(")"))
      );

    case "definition":
      return group(
        concat(
          lparen,
          text("define"),
          space,
          printVariable(sexpr.variable),
          indent(concat(line, print(sexpr.value))),
          rparen
        )
      );
  }
}

export function pprint(sexpr: Syntax, lineWidth: number): string {
  return pretty(print(sexpr), lineWidth);
}

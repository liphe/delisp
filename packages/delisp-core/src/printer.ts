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
  space,
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

function list(...docs: Doc[]): Doc {
  return group(concat(text("("), ...docs, text(")")));
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
      const argNames = sexpr.lambdaList.map(x => x.variable);
      return list(
        text("lambda"),
        space,
        list(align(...argNames.map(printVariable))),
        indent(concat(line, print(sexpr.body)))
      );
    case "function-call":
      const fn = print(sexpr.fn);
      const args = sexpr.args.map(print);
      return list(groupalign(fn, align(...args)));

    case "definition":
      return list(
        text("define"),
        space,
        printVariable(sexpr.variable),
        indent(concat(line, print(sexpr.value)))
      );
  }
}

export function pprint(sexpr: Syntax, lineWidth: number): string {
  return pretty(print(sexpr), lineWidth);
}

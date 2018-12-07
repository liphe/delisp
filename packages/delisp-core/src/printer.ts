import { concat, Doc, group, line, nest, pretty, text } from "./prettier";
import { Expression, Syntax } from "./syntax";

function printString(str: string): Doc {
  const escaped = str.replace(/\n/g, "\\n").replace(/"/g, '\\"');
  return text(`"${escaped}"`);
}

function printVariable(name: string): Doc {
  return text(name);
}

function join(docs: Doc[], sep: Doc) {
  return docs.reduce((a, d) => concat(a, sep, d));
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
      const args = sexpr.args.map(print);
      return group(
        concat(text("("), fn, line, join(args, text(" ")), text(")"))
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

import { readSyntax } from "./index";
console.log(
  pprint(
    readSyntax(
      "(funcall aaaaa aaaaa aaaaa aaaaa aaaaa aaaaa aaaaa aaaaa aaaaa aaaaa aaaaa aaaaa aaaaa aaaaa aaaaa aaaaa)"
    ),
    80
  )
);

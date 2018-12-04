import { concat, Doc, group, line, nest, pretty, text } from "./prettier";
import { Expression, Syntax } from "./syntax";

const LINE_WIDTH = 80;

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
  }
}

export function pprint(sexpr: Syntax): string {
  return pretty(print(sexpr), LINE_WIDTH);
}

import { readFromString } from "./reader";
import { convert } from "./convert";
const syntax = convert(
  readFromString(
    "(lambda (aaa bbb ccc ddd eee fff ggg hhh iii jjj kkk lll mmm nnn ooo ppp qqq) xxx)"
  )
);

// console.dir(print(syntax), { depth: null });
console.log(pprint(syntax));

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
import { Module, Syntax } from "./syntax";

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
  return concat(text("("), ...docs, text(")"));
}

function map(...docs: Doc[]): Doc {
  return concat(text("{"), ...docs, text("}"));
}

function print(sexpr: Syntax): Doc {
  switch (sexpr.type) {
    case "string":
      return printString(sexpr.value);
    case "number":
      return text(String(sexpr.value));
    case "vector": {
      const fn = text("vector");
      const args = sexpr.values.map(print);
      return group(list(groupalign(fn, align(...args))));
    }
    case "record": {
      return group(
        map(
          align(
            join(
              Object.entries(sexpr.fields).map(([k, v]) =>
                concat(text(k), space, print(v))
              ),
              line
            )
          )
        )
      );
    }
    case "variable-reference":
      return printVariable(sexpr.name);
    case "conditional":
      return group(
        list(
          text("if"),
          space,
          print(sexpr.condition),
          indent(
            concat(
              line,
              print(sexpr.consequent),
              line,
              print(sexpr.alternative)
            )
          )
        )
      );
    case "function":
      const argNames = sexpr.lambdaList.positionalArgs.map(x => x.variable);
      return group(
        list(
          text("lambda"),
          space,
          group(list(align(...argNames.map(printVariable)))),
          indent(concat(line, print(sexpr.body)))
        )
      );

    case "function-call": {
      const fn = print(sexpr.fn);
      const args = sexpr.args.map(print);
      return group(list(groupalign(fn, align(...args))));
    }

    case "definition":
      return group(
        list(
          text("define"),
          space,
          printVariable(sexpr.variable),
          indent(concat(line, print(sexpr.value)))
        )
      );

    case "let-bindings":
      return list(
        text("let"),
        space,
        list(
          align(
            ...sexpr.bindings.map(b => list(text(b.var), space, print(b.value)))
          )
        ),
        indent(concat(line, print(sexpr.body)))
      );
  }
}

export function pprint(sexpr: Syntax, lineWidth: number): string {
  return pretty(print(sexpr), lineWidth);
}

export function pprintModule(m: Module, lineWidth: number): string {
  return m.body.map(s => pprint(s, lineWidth)).join("\n\n");
}

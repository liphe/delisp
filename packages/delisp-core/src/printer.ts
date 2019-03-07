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

function vector(...docs: Doc[]): Doc {
  return concat(text("["), ...docs, text("]"));
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
      const args = sexpr.values.map(print);
      return group(vector(align(...args)));
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
          concat(
            text("if"),
            space,
            align(
              print(sexpr.condition),
              print(sexpr.consequent),
              print(sexpr.alternative)
            )
          )
        ),
        // NOTE: We don't want conditionals to be too long. We use a
        // much lower value here, we'll only group them if they are
        // realluy short.
        30
      );

    case "function":
      const argNames = sexpr.lambdaList.positionalArgs.map(x => x.variable);
      const singleBody = sexpr.body.length === 1;
      const doc = list(
        text("lambda"),
        space,
        group(list(align(...argNames.map(printVariable)))),
        indent(concat(line, join(sexpr.body.map(print), line)))
      );
      return singleBody ? group(doc) : doc;

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

    case "export":
      return group(
        list(
          text("export"),
          space,
          text(sexpr.name),
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

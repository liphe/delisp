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

import { printType } from "./type-printer";

function indent(x: Doc, level = 2): Doc {
  return indent_(x, level);
}

function printString(str: string): Doc {
  const escaped = str.replace(/\n/g, "\\n").replace(/"/g, '\\"');
  return text(`"${escaped}"`);
}

function printIdentifier(name: string): Doc {
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

function printBody(ss: Syntax[]): Doc {
  return concat(line, join(ss.map(print), line));
}

function print(sexpr: Syntax): Doc {
  switch (sexpr.tag) {
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
              sexpr.fields.map(({ label: k, value: v }) =>
                concat(text(k), space, print(v))
              ),
              line
            )
          )
        )
      );
    }
    case "identifier":
      return printIdentifier(sexpr.name);

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
      const argNames = sexpr.lambdaList.positionalArgs.map(x => x.name);
      const singleBody = sexpr.body.length === 1;
      const doc = list(
        text("lambda"),
        space,
        group(list(align(...argNames.map(printIdentifier)))),
        indent(printBody(sexpr.body))
      );
      return singleBody ? group(doc) : doc;

    case "function-call": {
      const fn = print(sexpr.fn);
      const args = sexpr.args.map(print);
      if (args.length === 0) {
        return group(list(fn));
      } else {
        return group(list(groupalign(fn, align(...args))));
      }
    }

    case "definition":
      return group(
        list(
          text("define"),
          space,
          printIdentifier(sexpr.variable),
          indent(concat(line, print(sexpr.value)))
        )
      );

    case "export":
      return list(text("export"), space, text(sexpr.value.name));

    case "let-bindings":
      return list(
        text("let"),
        space,
        map(
          align(
            ...sexpr.bindings.map(b =>
              concat(text(b.variable.name), space, print(b.value))
            )
          )
        ),
        indent(printBody(sexpr.body))
      );

    case "type-annotation":
      return group(
        list(
          text("the"),
          space,
          text(sexpr.typeWithWildcards.print()),
          indent(concat(line, print(sexpr.value)))
        )
      );

    case "type-alias":
      return group(
        list(
          text("type"),
          space,
          text(sexpr.name),
          indent(concat(line, text(printType(sexpr.definition, false))))
        )
      );
  }
}

export function pprint(sexpr: Syntax, lineWidth: number): string {
  return pretty(print(sexpr), lineWidth);
}

export function pprintModule(m: Module, lineWidth: number): string {
  return m.body
    .map((s, i) => {
      let newlines;
      if (i > 0) {
        const end = m.body[i - 1].location.end;
        const start = s.location.start;
        const between = s.location.input.toString().slice(end, start);
        newlines = between.split("\n").length - 1;
      } else {
        newlines = 0;
      }
      const nl = newlines > 1 ? "\n" : "";
      return nl + pprint(s, lineWidth);
    })
    .join("\n");
}

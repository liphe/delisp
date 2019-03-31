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
  switch (sexpr.node.tag) {
    case "string":
      return printString(sexpr.node.value);
    case "number":
      return text(String(sexpr.node.value));
    case "vector": {
      const args = sexpr.node.values.map(v => print(v));
      return group(vector(align(...args)));
    }
    case "record": {
      return group(
        map(
          align(
            join(
              sexpr.node.fields.map(({ label, value }) =>
                concat(text(label.name), space, print(value))
              ),
              line
            )
          )
        )
      );
    }
    case "variable-reference":
      return printIdentifier(sexpr.node.name);

    case "conditional":
      return group(
        list(
          concat(
            text("if"),
            space,
            align(
              print(sexpr.node.condition),
              print(sexpr.node.consequent),
              print(sexpr.node.alternative)
            )
          )
        ),
        // NOTE: We don't want conditionals to be too long. We use a
        // much lower value here, we'll only group them if they are
        // realluy short.
        30
      );

    case "function":
      const argNames = sexpr.node.lambdaList.positionalArgs.map(x => x.name);
      const singleBody = sexpr.node.body.length === 1;
      const doc = list(
        text("lambda"),
        space,
        group(list(align(...argNames.map(printIdentifier)))),
        indent(printBody(sexpr.node.body))
      );
      return singleBody ? group(doc) : doc;

    case "function-call": {
      const fn = print(sexpr.node.fn);
      const args = sexpr.node.args.map(print);
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
          printIdentifier(sexpr.node.variable.name),
          indent(concat(line, print(sexpr.node.value)))
        )
      );

    case "export":
      return list(text("export"), space, text(sexpr.node.value.name));

    case "let-bindings":
      return list(
        text("let"),
        space,
        map(
          align(
            ...sexpr.node.bindings.map(b =>
              concat(text(b.variable.name), space, print(b.value))
            )
          )
        ),
        indent(printBody(sexpr.node.body))
      );

    case "type-annotation":
      return group(
        list(
          text("the"),
          space,
          text(sexpr.node.typeWithWildcards.print()),
          indent(concat(line, print(sexpr.node.value)))
        )
      );

    case "type-alias":
      return group(
        list(
          text("type"),
          space,
          text(sexpr.node.alias.name),
          indent(concat(line, text(printType(sexpr.node.definition, false))))
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

import { InvariantViolation } from "./invariant";

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
import { isExpression, Expression, Module, Syntax } from "./syntax";

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

function printExpr(expr: Expression): Doc {
  switch (expr.node.tag) {
    case "string":
      return printString(expr.node.value);
    case "number":
      return text(String(expr.node.value));
    case "vector": {
      const args = expr.node.values.map(v => print(v));
      return group(vector(align(...args)));
    }
    case "record": {
      return group(
        map(
          align(
            join(
              expr.node.fields.map(({ label, value }) =>
                concat(text(label.name), space, print(value))
              ),
              line
            )
          )
        )
      );
    }
    case "variable-reference":
      return printIdentifier(expr.node.name);

    case "conditional":
      return group(
        list(
          concat(
            text("if"),
            space,
            align(
              print(expr.node.condition),
              print(expr.node.consequent),
              print(expr.node.alternative)
            )
          )
        ),
        // NOTE: We don't want conditionals to be too long. We use a
        // much lower value here, we'll only group them if they are
        // realluy short.
        30
      );

    case "function":
      const argNames = expr.node.lambdaList.positionalArgs.map(x => x.name);
      const singleBody = expr.node.body.length === 1;
      const doc = list(
        text("lambda"),
        space,
        group(list(align(...argNames.map(printIdentifier)))),
        indent(printBody(expr.node.body))
      );
      return singleBody ? group(doc) : doc;

    case "function-call": {
      const fn = print(expr.node.fn);
      const args = expr.node.args.map(print);
      if (args.length === 0) {
        return group(list(fn));
      } else {
        return group(list(groupalign(fn, align(...args))));
      }
    }

    case "let-bindings":
      return list(
        text("let"),
        space,
        map(
          align(
            ...expr.node.bindings.map(b =>
              concat(text(b.variable.name), space, print(b.value))
            )
          )
        ),
        indent(printBody(expr.node.body))
      );

    case "type-annotation":
      return group(
        list(
          text("the"),
          space,
          text(expr.node.typeWithWildcards.print()),
          indent(concat(line, print(expr.node.value)))
        )
      );
  }
}

function print(form: Syntax): Doc {
  if (isExpression(form)) {
    return printExpr(form);
  } else {
    switch (form.node.tag) {
      case "definition":
        return group(
          list(
            text("define"),
            space,
            printIdentifier(form.node.variable.name),
            indent(concat(line, print(form.node.value)))
          )
        );

      case "export":
        return list(text("export"), space, text(form.node.value.name));

      case "type-alias":
        return group(
          list(
            text("type"),
            space,
            text(form.node.alias.name),
            indent(concat(line, text(printType(form.node.definition, false))))
          )
        );

      default:
        throw new InvariantViolation(`Can't print this syntax.`);
    }
  }
}

export function pprint(form: Syntax, lineWidth: number): string {
  return pretty(print(form), lineWidth);
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

import { assertNever } from "./invariant";

import {
  align,
  concat,
  Doc,
  group,
  groupalign,
  indent as indent_,
  join,
  line,
  prettyAs,
  space,
  text,
  Encoder,
  encodeMany,
  StringEncoder
} from "./prettier";
import { isExpression, Expression, Module, Syntax } from "./syntax";
import { foldExpr } from "./syntax-utils";

import { printType } from "./type-printer";

function indent(x: Doc, level = 2): Doc {
  return indent_(x, level);
}

function printString(str: string): Doc {
  const escaped = str.replace(/\n/g, "\\n").replace(/"/g, '\\"');
  return text(`"${escaped}"`);
}

function printIdentifier(name: string, source?: Syntax): Doc {
  return text(name, source);
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

function lines(...docs: Doc[]): Doc {
  return concat(line, join(docs, line));
}

function printExpr(expr: Expression): Doc {
  return foldExpr(expr, e => {
    switch (e.node.tag) {
      case "unknown": {
        const { input, start, end } = e.location;
        return text(input.toString().slice(start, end));
      }
      case "string":
        return printString(e.node.value);
      case "number":
        return text(String(e.node.value));
      case "vector": {
        return group(vector(align(...e.node.values)));
      }
      case "record": {
        return group(
          map(
            align(
              join(
                e.node.fields.map(({ label, value }) =>
                  concat(text(label.name), space, value)
                ),
                line
              )
            )
          )
        );
      }
      case "variable-reference":
        return printIdentifier(e.node.name, { ...e, node: e.node });

      case "conditional":
        return group(
          list(
            concat(
              text("if"),
              space,
              align(e.node.condition, e.node.consequent, e.node.alternative)
            )
          ),
          // NOTE: We don't want conditionals to be too long. We use a
          // much lower value here, we'll only group them if they are
          // realluy short.
          30
        );

      case "function":
        const singleBody = e.node.body.length === 1;
        const doc = list(
          text("lambda"),
          space,
          group(
            list(
              align(
                ...e.node.lambdaList.positionalArgs.map(x =>
                  printIdentifier(x.name)
                )
              )
            )
          ),
          indent(lines(...e.node.body))
        );
        return singleBody ? group(doc) : doc;

      case "function-call": {
        const fn = e.node.fn;
        const args = e.node.args;
        return group(list(groupalign(fn, align(...args))));
      }

      case "let-bindings":
        return list(
          text("let"),
          space,
          map(
            align(
              ...e.node.bindings.map(b =>
                concat(text(b.variable.name), space, b.value)
              )
            )
          ),
          indent(lines(...e.node.body))
        );

      case "type-annotation":
        return group(
          list(
            text("the"),
            space,
            text(e.node.typeWithWildcards.print()),
            indent(concat(line, e.node.value))
          )
        );

      case "do-block":
        return list(
          concat(
            text("do"),
            indent(concat(line, join([...e.node.body, e.node.returning], line)))
          )
        );
    }
  });
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
        return assertNever(form.node);
    }
  }
}

export function pprintAs<A>(
  form: Syntax,
  lineWidth: number,
  encoder: Encoder<A>
): A {
  return prettyAs(print(form), lineWidth, encoder);
}

export function pprintModuleAs<A>(
  m: Module,
  lineWidth: number,
  encoder: Encoder<A>
): A {
  return encodeMany(
    encoder,
    m.body.map((s, i) => {
      let newlines;
      if (i > 0) {
        const end = m.body[i - 1].location.end;
        const start = s.location.start;
        const between = s.location.input.toString().slice(end, start);
        newlines = between.split("\n").length - 1;
      } else {
        newlines = 0;
      }
      const nl = encoder.fromString(newlines > 1 ? "\n" : "");
      return encoder.concat(nl, pprintAs(s, lineWidth, encoder));
    }),
    encoder.fromString("\n")
  );
}

export function pprint(form: Syntax, lineWidth: number): string {
  return prettyAs(print(form), lineWidth, StringEncoder);
}

export function pprintModule(m: Module, lineWidth: number): string {
  return pprintModuleAs(m, lineWidth, StringEncoder);
}

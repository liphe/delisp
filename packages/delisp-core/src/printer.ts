import { assertNever } from "./invariant";

import {
  nil,
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

function printString(str: string, source: Syntax): Doc {
  const escaped = str.replace(/\n/g, "\\n").replace(/"/g, '\\"');
  return text(`"${escaped}"`, "string", source);
}

function printIdentifier(name: string, source?: Syntax): Doc {
  return text(name, "identifier", source);
}

function list(...docs: Doc[]): Doc {
  return concat(text("(", "delimiter"), ...docs, text(")", "delimiter"));
}

function vector(...docs: Doc[]): Doc {
  return concat(text("[", "delimiter"), ...docs, text("]", "delimiter"));
}

function map(...docs: Doc[]): Doc {
  return concat(text("{", "delimiter"), ...docs, text("}", "delimiter"));
}

function lines(...docs: Doc[]): Doc {
  return concat(line, join(docs, line));
}

function printExpr(expr: Expression): Doc {
  return foldExpr(expr, (e, source) => {
    switch (e.node.tag) {
      case "unknown": {
        const { input, start, end } = e.location;
        return text(input.toString().slice(start, end), "unknown");
      }
      case "string":
        return printString(e.node.value, source);
      case "number":
        return text(String(e.node.value), "number", source);
      case "vector": {
        return group(vector(align(...e.node.values)));
      }
      case "record": {
        return group(
          map(
            align(
              join(
                [
                  ...e.node.fields.map(({ label, value }) =>
                    concat(text(label.name, "label"), space, value)
                  ),
                  ...(e.node.extends
                    ? [concat(text("|", "label-ext"), space, e.node.extends)]
                    : [])
                ],
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
              text("if", "keyword", source),
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
          text("lambda", "keyword", source),
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
          text("let", "keyword", source),
          space,
          map(
            align(
              ...e.node.bindings.map(b =>
                concat(text(b.variable.name, "identifier"), space, b.value)
              )
            )
          ),
          indent(lines(...e.node.body))
        );

      case "type-annotation":
        return group(
          list(
            text("the", "keyword", source),
            space,
            text(e.node.typeWithWildcards.print(), "type"),
            indent(concat(line, e.node.value))
          )
        );

      case "do-block":
        return list(
          concat(
            text("do", "keyword", source),
            indent(concat(line, join([...e.node.body, e.node.returning], line)))
          )
        );

      case "match":
        function printCase(pattern: Doc, body: Doc[]) {
          return group(
            concat(list(pattern, indent(concat(line, join(body, line)))))
          );
        }

        return list(
          concat(
            text("match", "keyword", source),
            space,
            e.node.value,
            indent(
              concat(
                line,
                join(
                  [
                    ...e.node.cases.map(c => {
                      return printCase(
                        map(
                          text(c.label, "keyword"),
                          space,
                          printIdentifier(c.variable.name)
                        ),
                        c.body
                      );
                    }),

                    e.node.defaultCase
                      ? printCase(
                          text(":default", "keyword"),
                          e.node.defaultCase
                        )
                      : nil
                  ],
                  line
                )
              )
            )
          )
        );

      case "case":
        return group(
          list(
            text("case", "keyword", source),
            space,
            text(e.node.label, "label"),
            e.node.value ? indent(concat(line, e.node.value)) : nil
          )
        );

      case "values": {
        return group(
          list(
            groupalign(
              text("values", "keyword", source),
              align(...e.node.values)
            )
          )
        );
      }

      case "multiple-value-bind":
        return nil;
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
            text("define", "keyword", form),
            space,
            printIdentifier(form.node.variable.name),
            indent(concat(line, print(form.node.value)))
          )
        );

      case "export":
        return list(
          text("export", "keyword", form),
          space,
          text(form.node.value.name, "identifier")
        );

      case "type-alias":
        return group(
          list(
            text("type", "keyword", form),
            space,
            text(form.node.alias.name, "identifier"),
            indent(
              concat(line, text(printType(form.node.definition, false), "type"))
            )
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

      const nl =
        newlines > 1
          ? encoder.fromString("\n", "space")
          : encoder.fromString("", "");
      return encoder.concat(nl, pprintAs(s, lineWidth, encoder));
    }),
    encoder.fromString("\n", "space")
  );
}

export function pprint(form: Syntax, lineWidth: number): string {
  return prettyAs(print(form), lineWidth, StringEncoder);
}

export function pprintModule(m: Module, lineWidth: number): string {
  return pprintModuleAs(m, lineWidth, StringEncoder);
}

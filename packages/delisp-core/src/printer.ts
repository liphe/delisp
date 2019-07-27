import { assertNever, InvariantViolation } from "./invariant";
import {
  align,
  concat,
  Doc,
  encodeMany,
  Encoder,
  group,
  groupalign,
  indent as indent_,
  join,
  line,
  nil,
  prettyAs,
  space,
  StringEncoder,
  text
} from "./prettier";
import * as S from "./syntax";
import { foldExpr } from "./syntax-utils";
import { printType } from "./type-printer";

function indent(x: Doc, level = 2): Doc {
  return indent_(x, level);
}

function printString(str: string, source: S.Syntax): Doc {
  const escaped = str.replace(/\n/g, "\\n").replace(/"/g, '\\"');
  return text(`"${escaped}"`, ["string"], source);
}

function printIdentifier(
  name: string,
  source?: S.Syntax,
  kinds: string[] = []
): Doc {
  return text(name, ["identifier", ...kinds], source);
}

function keyword(name: string, source?: S.Syntax): Doc {
  return text(name, ["keyword"], source);
}

function list(...docs: Doc[]): Doc {
  return concat(text("(", ["delimiter"]), ...docs, text(")", ["delimiter"]));
}

function vector(...docs: Doc[]): Doc {
  return concat(text("[", ["delimiter"]), ...docs, text("]", ["delimiter"]));
}

function map(...docs: Doc[]): Doc {
  return concat(text("{", ["delimiter"]), ...docs, text("}", ["delimiter"]));
}

function lines(...docs: Doc[]): Doc {
  return concat(line, join(docs, line));
}

function printCase(pattern: Doc, body: Doc[]) {
  return group(concat(list(pattern, indent(lines(...body)))));
}

function printExpr(expr: S.Expression): Doc {
  return foldExpr(expr, (e, source) => {
    switch (e.node.tag) {
      case "unknown": {
        if (!e.location) {
          throw new InvariantViolation(
            `Unknown syntax node has no location information.`
          );
        }
        const { input, start, end } = e.location;
        return text(input.toString().slice(start, end), ["unknown"]);
      }
      case "string":
        return printString(e.node.value, source);
      case "number":
        return text(String(e.node.value), ["number"], source);
      case "vector":
        return group(vector(align(...e.node.values)));
      case "boolean":
        return text(e.node.value.toString(), ["boolean"], source);
      case "record": {
        return group(
          map(
            align(
              join(
                [
                  ...e.node.fields.map(({ label, value }) =>
                    concat(text(label.name, ["label"]), space, value)
                  ),
                  ...(e.node.source
                    ? [concat(text("|", ["label-ext"]), space, e.node.source)]
                    : [])
                ],
                line
              )
            )
          )
        );
      }
      case "record-get":
        return group(
          list(
            concat(
              keyword("$get", source),
              space,
              text(e.node.field.name, ["label"], e),
              space,
              e.node.value
            )
          )
        );
      case "variable-reference":
        return printIdentifier(e.node.name, { ...e, node: e.node });

      case "conditional":
        return group(
          list(
            concat(
              keyword("if", source),
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
          keyword("lambda", source),
          space,
          group(
            list(
              align(
                ...e.node.lambdaList.userPositionalArguments.map(x =>
                  printIdentifier(x.name, undefined, ["argument"])
                )
              )
            )
          ),
          indent(lines(...e.node.body))
        );
        return singleBody ? group(doc) : doc;

      case "function-call": {
        const fn = e.node.fn;
        const args = e.node.userArguments;
        return group(list(groupalign(fn, align(...args))));
      }

      case "let-bindings":
        return list(
          keyword("let", source),
          space,
          map(
            align(
              ...e.node.bindings.map(b =>
                concat(
                  printIdentifier(b.variable.name, undefined, [
                    "lexical-variable-declaration"
                  ]),
                  space,
                  b.value
                )
              )
            )
          ),
          indent(lines(...e.node.body))
        );

      case "type-annotation":
        return group(
          list(
            keyword("the", source),
            space,
            text(e.node.typeWithWildcards.print(), ["type"]),
            indent(concat(line, e.node.value))
          )
        );

      case "do-block":
        return list(
          concat(
            keyword("do", source),
            indent(lines(...e.node.body, e.node.returning))
          )
        );

      case "match": {
        return list(
          concat(
            keyword("match", source),
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
                          keyword(c.label),
                          space,
                          printIdentifier(c.variable.name)
                        ),
                        c.body
                      );
                    }),

                    e.node.defaultCase
                      ? printCase(keyword(":default"), e.node.defaultCase)
                      : nil
                  ],
                  line
                )
              )
            )
          )
        );
      }

      case "case":
        return group(
          list(
            keyword("case", source),
            space,
            text(e.node.label, ["label"]),
            e.node.value ? indent(concat(line, e.node.value)) : nil
          )
        );

      case "values": {
        return group(
          list(groupalign(keyword("values", source), align(...e.node.values)))
        );
      }

      case "multiple-value-bind":
        return list(
          keyword("multiple-value-bind", source),
          space,
          // List of variables
          list(
            join(
              e.node.variables.map(v =>
                printIdentifier(v.name, source, ["lexical-variable-definition"])
              ),
              space
            )
          ),
          indent(concat(line, e.node.form), 4),
          indent(lines(...e.node.body))
        );
    }
  });
}

function print(form: S.Syntax): Doc {
  if (S.isExpression(form)) {
    return printExpr(form);
  } else {
    switch (form.node.tag) {
      case "definition":
        return group(
          list(
            keyword("define", form),
            space,
            printIdentifier(form.node.variable.name, undefined, [
              "variable-definition"
            ]),
            indent(concat(line, print(form.node.value)))
          )
        );

      case "import":
        return list(
          keyword("import", form),
          space,
          printIdentifier(form.node.variable.name),
          space,
          keyword(":from"),
          space,
          printString(form.node.source, form)
        );

      case "export":
        return list(
          keyword("export", form),
          space,
          form.node.identifiers.length === 1
            ? printIdentifier(form.node.identifiers[0].name, form)
            : group(
                vector(
                  align(
                    ...form.node.identifiers.map(i =>
                      printIdentifier(i.name, form)
                    )
                  )
                )
              )
        );

      case "type-alias":
        return group(
          list(
            keyword("type", form),
            space,
            printIdentifier(form.node.alias.name, undefined, ["definition"]),
            indent(
              concat(
                line,
                text(printType(form.node.definition, false), ["type"])
              )
            )
          )
        );
      default:
        return assertNever(form.node);
    }
  }
}

export function pprintAs<A>(
  form: S.Syntax,
  lineWidth: number,
  encoder: Encoder<A>
): A {
  return prettyAs(print(form), lineWidth, encoder);
}

export function pprintModuleAs<A>(
  m: S.Module,
  lineWidth: number,
  encoder: Encoder<A>
): A {
  return encodeMany(
    encoder,
    m.body.map((s, i) => {
      let newlines: number;
      if (i > 0) {
        const previousForm = m.body[i - 1];

        const end = previousForm.location
          ? previousForm.location.end
          : undefined;
        const start = s.location && s.location.start;
        const between =
          s.location && s.location.input.toString().slice(end, start);
        newlines = between ? between.split("\n").length - 1 : 1;
      } else {
        newlines = 0;
      }

      const nl =
        newlines > 1
          ? encoder.fromString("\n", ["space"])
          : encoder.fromString("", []);
      return encoder.concat(nl, pprintAs(s, lineWidth, encoder));
    }),
    encoder.fromString("\n", ["space"])
  );
}

export function pprint(form: S.Syntax, lineWidth: number): string {
  return prettyAs(print(form), lineWidth, StringEncoder);
}

export function pprintModule(m: S.Module, lineWidth: number): string {
  return pprintModuleAs(m, lineWidth, StringEncoder);
}

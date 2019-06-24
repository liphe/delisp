import { InvariantViolation } from "./invariant";
import { range } from "./utils";
import { TApplication, Type, tVar } from "./types";

import {
  normalizeRow,
  listTypeVariables,
  applySubstitution
} from "./type-utils";

function typeIndexName(index: number): string {
  const alphabet = "αβγδεζηθικμνξοπρστυφχψ";
  return index < alphabet.length
    ? alphabet[index]
    : `ω${index - alphabet.length + 1}`;
}

function normalizeType(t: Type): Type {
  const vars = listTypeVariables(t);
  const substitution = vars.reduce((s, v, i) => {
    const normalizedName = typeIndexName(i);
    return v === normalizedName
      ? s
      : {
          ...s,
          [v]: tVar(normalizedName)
        };
  }, {});
  return applySubstitution(t, substitution);
}

function printValuesType(fnout: Type, simplify = false): string {
  const row = normalizeRow(fnout);

  // primary value only
  if (simplify && row.fields.length === 1 && row.fields[0].label === "0") {
    return _printType(row.fields[0].labelType);
  } else {
    // full form (values a b c ...)
    return (
      "(values " +
      range(row.fields.length)
        .map(i => {
          const field = row.fields.find(f => f.label === String(i))!;
          return _printType(field.labelType);
        })
        .join(" ") +
      (row.extends.node.tag === "empty-row"
        ? ""
        : "| " + _printType(row.extends)) +
      ")"
    );
  }
}

function printApplicationType(type: TApplication, simplify = false): string {
  function genericApp(op: Type, args: Type[]): string {
    return "(" + [op, ...args].map(t => _printType(t)).join(" ") + ")";
  }

  if (type.node.op.node.tag === "constant") {
    switch (type.node.op.node.name) {
      case "vector": {
        return `[${_printType(type.node.args[0])}]`;
      }
      case "record": {
        const arg = type.node.args[0];
        const row = normalizeRow(arg);
        const fields = row.fields
          .map(f => `${f.label} ${_printType(f.labelType)}`)
          .join(" ");
        const extension =
          row.extends.node.tag !== "empty-row"
            ? ` | ${_printType(row.extends)}`
            : "";
        return `{${fields}${extension}}`;
      }
      case "effect": {
        const row = normalizeRow(type.node.args[0]);

        const fields = row.fields.map(f => " " + f.label).join("");
        const extending =
          row.extends.node.tag === "empty-row"
            ? ""
            : " | " + _printType(row.extends);

        return `(effect${fields}${extending})`;
      }

      case "cases": {
        const arg = type.node.args[0];
        const row = normalizeRow(arg);
        const fields = row.fields
          .map(f =>
            f.labelType.node.tag === "constant" &&
            f.labelType.node.name === "void"
              ? `${f.label}`
              : `(${f.label} ${_printType(f.labelType)})`
          )
          .join(" ");
        const extension =
          row.extends.node.tag !== "empty-row"
            ? ` ${_printType(row.extends)}`
            : "";
        return `(cases ${fields}${extension})`;
      }

      case "values":
        return printValuesType(type.node.args[0], simplify);

      case "->": {
        const { op, args } = type.node;
        return (
          "(" +
          [op, ...args]
            .map((t, i) => _printType(t, i === args.length))
            .join(" ") +
          ")"
        );
      }

      default: {
        return genericApp(type.node.op, type.node.args);
      }
    }
  } else {
    return genericApp(type.node.op, type.node.args);
  }
}

function _printType(type: Type, simplify = false): string {
  switch (type.node.tag) {
    case "constant":
      return type.node.name;
    case "application":
      return printApplicationType({ node: type.node }, simplify);
    case "type-variable":
      return type.node.name;
    case "empty-row":
    case "row-extension":
      throw new InvariantViolation(`Can't print ${type.node.tag} types`);
  }
}

function printTypeWithOptionalNormalization(rawType: Type, normalize = true) {
  const type = normalize ? normalizeType(rawType) : rawType;
  return _printType(type);
}

export { printTypeWithOptionalNormalization as printType };

// TODO: replace with the pretty printer

import { InvariantViolation } from "./invariant";
import { TApplication, emptyRow, Monotype, tVar } from "./types";

import { listTypeVariables, applySubstitution } from "./type-utils";

function typeIndexName(index: number): string {
  const alphabet = "αβγδεζηθικμνξοπρστυφχψ";
  return index < alphabet.length
    ? alphabet[index]
    : `ω${index - alphabet.length + 1}`;
}

function normalizeType(t: Monotype): Monotype {
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

function normalizeRow(
  type: Monotype
): {
  fields: Array<{ label: string; labelType: Monotype }>;
  extends: Monotype;
} {
  if (
    type.type !== "empty-row" &&
    type.type !== "row-extension" &&
    type.type !== "type-variable"
  ) {
    throw new InvariantViolation(`Row tail should be a row-kinded type.`);
  }

  switch (type.type) {
    case "empty-row":
      return { fields: [], extends: emptyRow };
    case "type-variable":
      return { fields: [], extends: type };
    case "row-extension":
      const { fields, extends: row } = normalizeRow(type.extends);
      return {
        fields: [{ label: type.label, labelType: type.labelType }, ...fields],
        extends: row
      };
  }
}

function printApplicationType(type: TApplication): string {
  switch (type.op) {
    case "vector":
      return `[${_printType(type.args[0])}]`;
    case "record":
      const arg = type.args[0];
      const row = normalizeRow(arg);
      const fields = row.fields
        .map(f => `${f.label} ${_printType(f.labelType)}`)
        .join(" ");
      const extension =
        row.extends.type !== "empty-row" ? ` | ${_printType(row.extends)}` : "";
      return `{${fields}${extension}}`;

    default:
      return `(${type.op} ${type.args.map(_printType).join(" ")})`;
  }
}

function _printType(type: Monotype): string {
  switch (type.type) {
    case "application":
      return printApplicationType(type);
    case "void":
      return "void";
    case "boolean":
      return "boolean";
    case "number":
      return "number";
    case "string":
      return "string";
    case "type-variable":
      return type.name;
    case "user-defined-type":
      return type.name;
    case "empty-row":
    case "row-extension":
      throw new InvariantViolation(`Can't print ${type.type} types`);
  }
}

export function printType(rawType: Monotype, normalize = true) {
  const type = normalize ? normalizeType(rawType) : rawType;
  return _printType(type);
}

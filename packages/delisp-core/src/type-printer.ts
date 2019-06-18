// TODO: replace with the pretty printer

// import { InvariantViolation } from "./invariant";
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

function printApplicationType(type: TApplication): string {
  if (
    type.node.op.node.tag === "constant" &&
    type.node.op.node.name === "vector"
  ) {
    return `[${_printType(type.node.args[0])}]`;
  } else if (
    type.node.op.node.tag === "constant" &&
    type.node.op.node.name === "record"
  ) {
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
  } else if (
    type.node.op.node.tag === "constant" &&
    type.node.op.node.name === "effect"
  ) {
    const row = normalizeRow(type.node.args[0]);

    const fields = row.fields.map(f => " " + f.label).join("");
    const extending =
      row.extends.node.tag === "empty-row"
        ? ""
        : " | " + _printType(row.extends);

    return `(effect${fields}${extending})`;
  } else if (
    type.node.op.node.tag === "constant" &&
    type.node.op.node.name === "or"
  ) {
    const arg = type.node.args[0];
    const row = normalizeRow(arg);
    const fields = row.fields
      .map(f => `${f.label} ${_printType(f.labelType)}`)
      .join(" ");
    const extension =
      row.extends.node.tag !== "empty-row"
        ? ` | ${_printType(row.extends)}`
        : "";
    return `(or {${fields}${extension}})`;
  } else {
    return (
      "(" + [type.node.op, ...type.node.args].map(_printType).join(" ") + ")"
    );
  }
}

function _printType(type: Type): string {
  switch (type.node.tag) {
    case "constant":
      return type.node.name;
    case "application":
      return printApplicationType({ node: type.node });
    case "type-variable":
      return type.node.name;
    case "empty-row":
    case "row-extension":
      return JSON.stringify(type, null, 2);
    // throw new InvariantViolation(`Can't print ${type.node.tag} types`);
  }
}

function printTypeWithOptionalNormalization(rawType: Type, normalize = true) {
  const type = normalize ? normalizeType(rawType) : rawType;
  return _printType(type);
}

export { printTypeWithOptionalNormalization as printType };

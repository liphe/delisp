// TODO: replace with the pretty printer

import { InvariantViolation } from "./invariant";
import { TApplication, TypeF, tVar } from "./types";

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

function normalizeType(t: TypeF): TypeF {
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
  if (type.op.node.tag === "constant" && type.op.node.name === "vector") {
    return `[${_printType(type.args[0].node)}]`;
  } else if (
    type.op.node.tag === "constant" &&
    type.op.node.name === "record"
  ) {
    const arg = type.args[0].node;
    const row = normalizeRow(arg);
    const fields = row.fields
      .map(f => `${f.label} ${_printType(f.labelType)}`)
      .join(" ");
    const extension =
      row.extends.tag !== "empty-row" ? ` | ${_printType(row.extends)}` : "";
    return `{${fields}${extension}}`;
  } else {
    return (
      "(" + [type.op, ...type.args].map(e => _printType(e.node)).join(" ") + ")"
    );
  }
}

function _printType(type: TypeF): string {
  switch (type.tag) {
    case "constant":
      return type.name;
    case "application":
      return printApplicationType(type);
    case "type-variable":
      return type.name;
    case "empty-row":
    case "row-extension":
      throw new InvariantViolation(`Can't print ${type.tag} types`);
  }
}

export function printType(rawType: TypeF, normalize = true) {
  const type = normalize ? normalizeType(rawType) : rawType;
  return _printType(type);
}

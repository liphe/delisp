import { Type } from "./types";
import { applySubstitution, Substitution } from "./unify";
import { flatten, unique } from "./utils";

// Return the list of type variables in the order they show up
function listTypeVariables(t: Type): string[] {
  switch (t.type) {
    case "string":
      return [];
    case "number":
      return [];
    case "application":
      return unique(flatten(t.args.map(listTypeVariables)));
    case "type-variable":
      return [t.name];
  }
}

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
          [v]: {
            type: "type-variable",
            name: normalizedName
          }
        };
  }, {});
  return applySubstitution(t, substitution);
}

function _printType(type: Type): string {
  switch (type.type) {
    case "application":
      return `(${type.op} ${type.args.map(_printType).join(" ")})`;
    case "number":
      return "number";
    case "string":
      return "string";
    case "type-variable":
      return type.name;
  }
}

export function printType(rawType: Type) {
  const type = normalizeType(rawType);
  return _printType(type);
}

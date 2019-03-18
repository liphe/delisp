import { InvariantViolation } from "./invariant";

import { convert as convertType } from "./convert-type";
import { readFromString } from "./reader";
import { generateUniqueTVar } from "./type-generate";
import { applySubstitution } from "./type-substitution";
import {
  emptyRow,
  Monotype,
  TApplication,
  TUserDefined,
  tVar,
  Type
} from "./types";
import { flatMap, unique } from "./utils";

// Return user defined types
export function listUserDefinedReferences(t: Monotype): TUserDefined[] {
  switch (t.type) {
    case "void":
    case "boolean":
    case "string":
    case "number":
    case "empty-row":
    case "type-variable":
      return [];
    case "user-defined-type":
      return [t];
    case "application":
      return flatMap(listUserDefinedReferences, t.args);
    case "row-extension":
      return [
        ...listUserDefinedReferences(t.labelType),
        ...listUserDefinedReferences(t.extends)
      ];
  }
}

// Return the list of type variables in the order they show up
export function listTypeVariables(t: Monotype): string[] {
  switch (t.type) {
    case "void":
    case "boolean":
    case "string":
    case "number":
    case "user-defined-type":
    case "empty-row":
      return [];
    case "application":
      return unique(flatMap(listTypeVariables, t.args));
    case "row-extension":
      return unique([
        ...listTypeVariables(t.labelType),
        ...listTypeVariables(t.extends)
      ]);
    case "type-variable":
      return [t.name];
  }
}

export function generalize(t: Monotype, monovars: string[]): Type {
  const vars = listTypeVariables(t);
  return {
    type: "type",
    // All free variables in the type that are not in the set of
    // monomorphic set must be polymorphic. So we generalize over
    // them.
    tvars: vars.filter(v => !monovars.includes(v)),
    mono: t
  };
}

export function isWildcardTypeVarName(name: string): boolean {
  return name.startsWith("_");
}

export function instantiate(t: Type, userSpecified = false): Monotype {
  const subst = t.tvars.reduce((s, vname) => {
    return {
      ...s,
      [vname]: generateUniqueTVar(
        isWildcardTypeVarName(vname) ? false : userSpecified
      )
    };
  }, {});
  return applySubstitution(t.mono, subst);
}

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

export function readType(source: string): Type {
  return generalize(convertType(readFromString(source)), []);
}

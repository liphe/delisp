import { InvariantViolation } from "./invariant";

import { convert as convertType } from "./convert-type";
import { readFromString } from "./reader";
import { generateUniqueTVar } from "./type-generate";

import {
  Type,
  tApp,
  tRowExtension,
  emptyRow,
  TUserDefined,
  TypeSchema
} from "./types";
import { flatMap, unique } from "./utils";

export function transformRecurType(t: Type, fn: (t1: Type) => Type): Type {
  switch (t.tag) {
    case "void":
    case "boolean":
    case "number":
    case "string":
    case "type-variable":
    case "user-defined-type":
    case "empty-row":
      return fn(t);
    case "application":
      return fn(tApp(t.op, ...t.args.map(t1 => transformRecurType(t1, fn))));
    case "row-extension":
      return tRowExtension(
        t.label,
        transformRecurType(t.labelType, fn),
        transformRecurType(t.extends, fn)
      );
  }
}

export interface Substitution {
  [t: string]: Type;
}

export function applySubstitution(t: Type, env: Substitution): Type {
  return transformRecurType(t, t1 => {
    if (t1.tag === "type-variable") {
      if (t1.name in env) {
        const tt = env[t1.name];
        return applySubstitution(tt, env);
      } else {
        return t1;
      }
    } else {
      return t1;
    }
  });
}

// Return user defined types
export function listUserDefinedReferences(t: Type): TUserDefined[] {
  switch (t.tag) {
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
export function listTypeVariables(t: Type): string[] {
  switch (t.tag) {
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

export function generalize(t: Type, monovars: string[]): TypeSchema {
  const vars = listTypeVariables(t);
  return {
    tag: "type",
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

export function instantiate(t: TypeSchema, userSpecified = false): Type {
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

export function readType(source: string): TypeSchema {
  return generalize(convertType(readFromString(source)), []);
}

export function normalizeRow(
  type: Type
): {
  fields: Array<{ label: string; labelType: Type }>;
  extends: Type;
} {
  if (
    type.tag !== "empty-row" &&
    type.tag !== "row-extension" &&
    type.tag !== "type-variable"
  ) {
    throw new InvariantViolation(`Row tail should be a row-kinded type.`);
  }
  switch (type.tag) {
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

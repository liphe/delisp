import { InvariantViolation } from "./invariant";

import { convert as convertType } from "./convert-type";
import { readFromString } from "./reader";
import { generateUniqueTVar } from "./type-generate";
import { flatten } from "./utils";

import {
  Type,
  TypeNode,
  emptyRow,
  TypeSchema,
  TConstant,
  TApplication
} from "./types";
import { unique } from "./utils";

export function isFunctionType(t: Type): t is TApplication {
  return (
    t.tag === "application" &&
    t.op.type.tag === "constant" &&
    t.op.type.name === "->"
  );
}

export function typeChildren<A>(type: Type<A[]>): A[] {
  switch (type.tag) {
    case "constant":
    case "type-variable":
    case "empty-row":
      return [];
    case "application":
      return flatten([type.op, ...type.args]);
    case "row-extension":
      return [...type.labelType, ...type.extends];
  }
}

export function foldType<A>(type: Type, fn: (t: Type<A>) => A): A {
  switch (type.tag) {
    case "constant":
    case "type-variable":
    case "empty-row":
      return fn(type);
    case "application":
      return fn({
        tag: "application",
        op: foldType(type.op.type, fn),
        args: type.args.map(a => foldType(a.type, fn))
      });
    case "row-extension":
      return fn({
        tag: "row-extension",
        label: type.label,
        labelType: foldType(type.labelType.type, fn),
        extends: foldType(type.extends.type, fn)
      });
  }
}

export function transformRecurType(type: Type, fn: (t: Type) => Type): Type {
  const node = foldType(type, (t: Type): TypeNode => ({ type: fn(t) }));
  return node.type;
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
export function listTypeConstants(type: Type): TConstant[] {
  return foldType(type, t => {
    return t.tag === "constant" ? [t] : typeChildren(t);
  });
}

// Return the list of type variables in the order they show up
export function listTypeVariables(type: Type): string[] {
  return foldType(type, t => {
    return t.tag === "type-variable" ? [t.name] : unique(typeChildren(t));
  });
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
      const { fields, extends: row } = normalizeRow(type.extends.type);
      return {
        fields: [
          { label: type.label, labelType: type.labelType.type },
          ...fields
        ],
        extends: row
      };
  }
}

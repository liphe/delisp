import { InvariantViolation } from "./invariant";

import { convert as convertType } from "./convert-type";
import { readFromString } from "./reader";
import { generateUniqueTVar } from "./type-generate";
import { flatten } from "./utils";

import {
  TypeF,
  Type,
  emptyRow,
  TypeSchema,
  TConstant,
  TApplication
} from "./types";
import { unique } from "./utils";

export function isFunctionType(t: TypeF): t is TApplication {
  return (
    t.tag === "application" &&
    t.op.node.tag === "constant" &&
    t.op.node.name === "->"
  );
}

export function typeChildren<A>(type: TypeF<A[]>): A[] {
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

export function foldType<A>(type: TypeF, fn: (t: TypeF<A>) => A): A {
  switch (type.tag) {
    case "constant":
    case "type-variable":
    case "empty-row":
      return fn(type);
    case "application":
      return fn({
        tag: "application",
        op: foldType(type.op.node, fn),
        args: type.args.map(a => foldType(a.node, fn))
      });
    case "row-extension":
      return fn({
        tag: "row-extension",
        label: type.label,
        labelType: foldType(type.labelType.node, fn),
        extends: foldType(type.extends.node, fn)
      });
  }
}

export function transformRecurType(
  type: TypeF,
  fn: (t: TypeF) => TypeF
): TypeF {
  const node = foldType(type, (t: TypeF): Type => ({ node: fn(t) }));
  return node.node;
}

export interface Substitution {
  [t: string]: TypeF;
}

export function applySubstitution(t: TypeF, env: Substitution): TypeF {
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
export function listTypeConstants(type: TypeF): TConstant[] {
  return foldType(type, t => {
    return t.tag === "constant" ? [t] : typeChildren(t);
  });
}

// Return the list of type variables in the order they show up
export function listTypeVariables(type: TypeF): string[] {
  return foldType(type, t => {
    return t.tag === "type-variable" ? [t.name] : unique(typeChildren(t));
  });
}

export function generalize(t: TypeF, monovars: string[]): TypeSchema {
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

export function instantiate(t: TypeSchema, userSpecified = false): TypeF {
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
  type: TypeF
): {
  fields: Array<{ label: string; labelType: TypeF }>;
  extends: TypeF;
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
      const { fields, extends: row } = normalizeRow(type.extends.node);
      return {
        fields: [
          { label: type.label, labelType: type.labelType.node },
          ...fields
        ],
        extends: row
      };
  }
}

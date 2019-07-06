import { InvariantViolation } from "./invariant";
import { last, flatten } from "./utils";
import { generateUniqueTVar } from "./type-generate";

import {
  Type,
  TypeF,
  emptyRow,
  TypeSchema,
  TConstant,
  TApplication,
  TVar,
  tValues
} from "./types";
import { unique } from "./utils";

export function isTVar(t: Type): t is TVar {
  return t.node.tag === "type-variable";
}

export function onlyPrimaryType(t: Type): Type {
  return { ...t, node: { ...t.node } };
}

export function isConstantApplicationType(t: Type, opname: string) {
  return (
    t.node.tag === "application" &&
    t.node.op.node.tag === "constant" &&
    t.node.op.node.name === opname
  );
}

export function isFunctionType(t: Type): t is TApplication {
  return isConstantApplicationType(t, "->");
}

export function typeChildren<A>(type: TypeF<A[]>): A[] {
  switch (type.node.tag) {
    case "constant":
    case "type-variable":
    case "empty-row":
      return [];
    case "application":
      return flatten([type.node.op, ...type.node.args]);
    case "row-extension":
      return [...type.node.labelType, ...type.node.extends];
  }
}

export function mapType<A, B>(type: TypeF<A>, fn: (x: A) => B): TypeF<B> {
  switch (type.node.tag) {
    case "constant":
    case "type-variable":
    case "empty-row":
      return {
        ...type,
        node: {
          ...type.node
        }
      };
    case "application":
      return {
        node: {
          tag: "application",
          op: fn(type.node.op),
          args: type.node.args.map(fn)
        }
      };
    case "row-extension":
      return {
        node: {
          tag: "row-extension",
          label: type.node.label,
          labelType: fn(type.node.labelType),
          extends: fn(type.node.extends)
        }
      };
  }
}

export function foldType<A>(type: Type, fn: (t: TypeF<A>) => A): A {
  return fn(mapType(type, t => foldType(t, fn)));
}

export function transformRecurType(type: Type, fn: (t: Type) => Type): Type {
  const node = foldType(type, (t: Type): Type => fn(t));
  return node;
}

export interface Substitution {
  [t: string]: Type;
}

export function applySubstitution(t: Type, env: Substitution): Type {
  return transformRecurType(t, t1 => {
    if (t1.node.tag === "type-variable") {
      if (t1.node.name in env) {
        const tt = env[t1.node.name];
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
    return t.node.tag === "constant"
      ? [
          {
            node: {
              ...t.node,
              nextType: undefined
            }
          }
        ]
      : typeChildren(t);
  });
}

// Return the list of type variables in the order they show up
export function listTypeVariables(type: Type): string[] {
  return foldType(type, t => {
    return t.node.tag === "type-variable"
      ? [t.node.name]
      : unique(typeChildren(t));
  });
}

export function generalize(t: Type, monovars: string[]): TypeSchema {
  // All free variables in the type that are not in the set of
  // monomorphic set must be polymorphic. So we generalize over
  // them.
  const vars = listTypeVariables(t);
  return new TypeSchema(vars.filter(v => !monovars.includes(v)), t);
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

export function normalizeRow(
  type: Type
): {
  fields: Array<{ label: string; labelType: Type }>;
  extends: Type;
} {
  if (
    type.node.tag !== "empty-row" &&
    type.node.tag !== "row-extension" &&
    type.node.tag !== "type-variable"
  ) {
    throw new InvariantViolation(`Row tail should be a row-kinded type.`);
  }
  switch (type.node.tag) {
    case "empty-row":
      return { fields: [], extends: emptyRow };
    case "type-variable":
      return { fields: [], extends: type };
    case "row-extension":
      const { fields, extends: row } = normalizeRow(type.node.extends);
      return {
        fields: [
          { label: type.node.label, labelType: type.node.labelType },
          ...fields
        ],
        extends: row
      };
  }
}

/** Normalize the values types in a type.
 *
 * @description Transform a type to ensure only VALUES type or type
 * variables appear in the codomain of functions types. */
export function normalizeValues(type: Type): Type {
  return foldType(type, t => {
    if (isFunctionType(t)) {
      const out = last(t.node.args)!;
      if (isConstantApplicationType(out, "values")) {
        return t;
      } else {
        return {
          node: {
            ...t.node,
            args: [...t.node.args.slice(0, -1), tValues([out])]
          }
        };
      }
    } else {
      return t;
    }
  });
}

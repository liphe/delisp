import { InvariantViolation } from "./invariant";
import { generateUniqueTVar } from "./type-generate";
import * as T from "./types";
import { flatten, flatMap, last, unique } from "./utils";

export function isEmtpyRow(t: T.Type): boolean {
  return t.node.tag === "empty-row";
}

export function isTVar(t: T.Type): t is T.Var {
  return t.node.tag === "type-variable";
}

export function onlyPrimaryType(t: T.Type): T.Type {
  return { ...t, node: { ...t.node } };
}

export function isConstantApplicationType(
  t: T.Type,
  opname: string
): t is T.Application {
  return (
    t.node.tag === "application" &&
    t.node.op.node.tag === "constant" &&
    t.node.op.node.name === opname
  );
}

export function isFunctionType(t: T.Type): t is T.Application {
  return isConstantApplicationType(t, "->");
}

export function countTypeOccurrences(variable: T.Var, type: T.Type): number {
  return foldType(type, (t) => {
    return t.node.tag === "type-variable" && t.node.name === variable.node.name
      ? 1
      : typeChildren(t).reduce((x, y) => x + y, 0);
  });
}

export function typeChildren<A>(type: T.TypeF<A>): A[] {
  switch (type.node.tag) {
    case "constant":
    case "type-variable":
    case "empty-row":
      return [];
    case "application":
      return [type.node.op, ...type.node.args];
    case "row-extension":
      return [type.node.labelType, type.node.extends];
  }
}

export function mapType<A, B>(type: T.TypeF<A>, fn: (x: A) => B): T.TypeF<B> {
  switch (type.node.tag) {
    case "constant":
    case "type-variable":
    case "empty-row":
      return {
        ...type,
        node: {
          ...type.node,
        },
      };
    case "application":
      return {
        node: {
          tag: "application",
          op: fn(type.node.op),
          args: type.node.args.map(fn),
        },
      };
    case "row-extension":
      return {
        node: {
          tag: "row-extension",
          label: type.node.label,
          labelType: fn(type.node.labelType),
          extends: fn(type.node.extends),
        },
      };
  }
}

export function foldType<A>(type: T.Type, fn: (t: T.TypeF<A>) => A): A {
  return fn(mapType(type, (t) => foldType(t, fn)));
}

export function transformRecurType(
  type: T.Type,
  fn: (t: T.Type) => T.Type
): T.Type {
  const node = foldType(type, (t: T.Type): T.Type => fn(t));
  return node;
}

export interface Substitution {
  [t: string]: T.Type;
}

export function applySubstitution(t: T.Type, env: Substitution): T.Type {
  return transformRecurType(t, (t1) => {
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
export function listTypeConstants(type: T.Type): T.Constant[] {
  return foldType(type, (t) => {
    return t.node.tag === "constant"
      ? [
          {
            node: {
              ...t.node,
              nextType: undefined,
            },
          },
        ]
      : flatten(typeChildren(t));
  });
}

// Return the list of type variables in the order they show up
export function listTypeVariables(type: T.Type): string[] {
  return foldType(type, (t) => {
    return t.node.tag === "type-variable"
      ? [t.node.name]
      : unique(flatten(typeChildren(t)));
  });
}

export function generalize(t: T.Type, monovars: string[]): T.TypeSchema {
  // All free variables in the type that are not in the set of
  // monomorphic set must be polymorphic. So we generalize over
  // them.
  const vars = listTypeVariables(t);
  return new T.TypeSchema(
    vars.filter((v) => !monovars.includes(v)),
    t
  );
}

export function isWildcardTypeVarName(name: string): boolean {
  return name.startsWith("_");
}

export function instantiate(t: T.TypeSchema, userSpecified = false): T.Type {
  const subst = t.tvars.reduce((s, vname) => {
    return {
      ...s,
      [vname]: generateUniqueTVar(
        isWildcardTypeVarName(vname) ? false : userSpecified
      ),
    };
  }, {});
  return applySubstitution(t.mono, subst);
}

export function normalizeRow(
  type: T.Type
): {
  fields: { label: string; labelType: T.Type }[];
  extends: T.Type;
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
      return { fields: [], extends: T.emptyRow };
    case "type-variable":
      return { fields: [], extends: type };
    case "row-extension":
      const { fields, extends: row } = normalizeRow(type.node.extends);
      return {
        fields: [
          { label: type.node.label, labelType: type.node.labelType },
          ...fields,
        ],
        extends: row,
      };
  }
}

/** Normalize the values types in a type.
 *
 * @description Transform a type to ensure only VALUES type or type
 * variables appear in the codomain of functions types. */
export function normalizeValues(type: T.Type): T.Type {
  return foldType(type, (t) => {
    if (isFunctionType(t)) {
      const out = last(t.node.args)!;
      if (isConstantApplicationType(out, "values")) {
        return t;
      } else {
        return {
          node: {
            ...t.node,
            args: [...t.node.args.slice(0, -1), T.values([out])],
          },
        };
      }
    } else {
      return t;
    }
  });
}

/** Decompose a function type into arguments, effect and output. */
export function decomposeFunctionType(type: T.Application) {
  const args = type.node.args.slice(0, -2);
  const [effect, output] = type.node.args.slice(-2);
  return { args, effect, output };
}

export function normalizeEffect(effect: T.Type) {
  if (!isConstantApplicationType(effect, "effect")) {
    throw new InvariantViolation(`Effect type must be a (effect ...) type.`);
  }
  return normalizeRow(effect.node.args[0]);
}

export function normalizeOutput(output: T.Type) {
  if (!isConstantApplicationType(output, "values")) {
    throw new InvariantViolation(`Output type must be a (values ...) type.`);
  }
  return normalizeRow(output.node.args[0]);
}

/** Return the number of input arguments of a function type. */
export function typeArity(type: T.Application): number {
  return decomposeFunctionType(type).args.length;
}

/** Open an effect type.
 *
 * @description
 * If the type did not change, return the argument.
 *
 * @example
 *
 * Converts the type
 *   (effect console)
 *
 * into
 *   (effect console <| e)
 */
export function openEffect(type: T.Type): T.Type {
  if (isConstantApplicationType(type, "effect")) {
    const row = normalizeEffect(type);
    if (row.extends.node.tag === "empty-row") {
      return T.effect(
        row.fields.map((f) => f.label),
        generateUniqueTVar()
      );
    } else {
      return type;
    }
  } else {
    return type;
  }
}

/** Open the effect of a function type with closed effect. */
export function openFunctionEffect(type: T.Type): T.Type {
  if (isFunctionType(type)) {
    const args = type.node.args.slice(0, -2);
    const [effect, output] = type.node.args.slice(-2);

    const openedEffect = openEffect(effect);
    if (openedEffect === effect) {
      return type;
    } else {
      return T.multiValuedFunction(args, openedEffect, output);
    }
  } else {
    return type;
  }
}

/** Instantiate a type schema for a specific variable only
 *
 * @example
 *
 * A type like
 *   (forall (a e b) (-> a e b))
 *
 * can be instantiated for b = number, returning the type
 *   (forall (a e) (-> a e number))
 *
 **/
export function instantiateTypeSchemaForVariable(
  polytype: T.TypeSchema,
  tvar: T.Var,
  replacement: T.Type
): T.TypeSchema {
  const varname = tvar.node.name;
  return new T.TypeSchema(
    polytype.tvars.filter((tv) => tv !== varname),
    applySubstitution(polytype.mono, {
      [varname]: replacement,
    })
  );
}

/** Close the effect of a function type.
 *
 * @description
 *
 * This function closes the 'superflous' effect polymorphism of a
 * function. For example, the most general type for the identity
 * function is the type
 *
 *   (forall (_ctx a e) (-> _ctx a e a))
 *
 * Note that the effect variable does not show up anywhere else in the
 * type of the function. When that is the case, this function will
 * close over that effect by returning a closed function like
 *
 *   (forall (_ctx a) (-> _ctx a (effect) a))
 *
 * The resulting type can be opened (once instantiated) with the
 * `openFunctionEffect` function.
 *
 * This operation is done to record the individual effect of some
 * forms, before it gets unified with other surrounding forms.
 *
 */
export function closeFunctionEffect(polytype: T.TypeSchema): T.TypeSchema {
  if (isFunctionType(polytype.mono)) {
    const fn: T.Application = polytype.mono;

    const { args, effect, output } = decomposeFunctionType(fn);
    const effectRow = normalizeEffect(effect);
    const effectTail = effectRow.extends;

    if (effectTail.node.tag === "empty-row") {
      // It's already a closed effect
      return polytype;
    }

    if (!isTVar(effectTail)) {
      throw new InvariantViolation(
        `Tail of an effect should be a type variable or empty row.`
      );
    }

    // Note that for high order functions we have to be a bit more
    // careful.
    //
    // A function with type
    //   (-> _ctx (-> _ctx number e number) e number)
    //
    // can't be closed over `e`, as we would loose the information
    // about the other 'e' instance.
    //
    const freevars: string[] = [
      ...flatMap(listTypeVariables, args),
      ...listTypeVariables(output),
    ];

    const isPolymorphicOnEffect = polytype.tvars.includes(effectTail.node.name);

    if (!isPolymorphicOnEffect || freevars.includes(effectTail.node.name)) {
      return polytype;
    } else {
      return instantiateTypeSchemaForVariable(polytype, effectTail, T.emptyRow);
    }
  } else {
    return polytype;
  }
}

export function getCallEffects(t: T.Type) {
  const effect = isFunctionType(t)
    ? decomposeFunctionType(t).effect
    : T.effect([]);
  return normalizeEffect(effect);
}

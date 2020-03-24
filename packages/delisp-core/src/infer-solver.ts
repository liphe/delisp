import { printHighlightedExpr } from "./error-report";
import { assertNever } from "./invariant";
import { pprint } from "./printer";
import * as S from "./syntax";
import { Typed } from "./syntax-typed";
import { printType } from "./type-printer";
import {
  applySubstitution,
  generalize,
  instantiate,
  listTypeVariables,
  Substitution,
  openFunctionEffect,
  closeFunctionEffect,
} from "./type-utils";
import * as T from "./types";
import { unify } from "./type-unify";
import { difference, flatMap, intersection, union } from "./utils";

const DEBUG = false;

// Constraints impose which types should be equal (unified) and which
// types are instances of other types.
export type TConstraint =
  | TConstraintEqual
  | TConstraintImplicitInstance
  | TConstraintExplicitInstance;

// A constraint stating that an expression's type should be equal to a
// given type.
interface TConstraintEqual {
  tag: "equal-constraint";
  t1: T.Type;
  t2: T.Type;
  source?: {
    expr: S.Expression<Typed>;
    kind: string;
  };
}

// A constraint stating that an expression's type is an instance of a
// generalization of t. For example, if
//
//    expr :: string -> a0 -> a0
//    t    =  c  -> b0 -> b0
//    monovars = [c]
//
// means that t can be generalized respect to all non-monomorphic
// variables. So we'll generalize to a type
//
//    forall b.  c -> b -> b
//
// keeping c fixed, as we assume it is a ground type or already an
// instantiation from another type at this point.
//
interface TConstraintImplicitInstance {
  tag: "implicit-instance-constraint";
  type: T.Type;
  typeToGeneralize: T.Type;
  monovars: string[];
  closedFunctionEffect?: T.Type;
  source?: {
    expr: S.Expression<Typed>;
  };
}

// A constriant stating that an expression's type is an instance of
// the (poly)type t.  This is generated when we already know somehow
// the generalized type of an expression. For example if the user has
// provided some type annotations.
interface TConstraintExplicitInstance {
  tag: "explicit-instance-constraint";
  type: T.Type;
  typeSchema: T.TypeSchema;
  closedFunctionEffect?: T.Type;
  source?: {
    expr: S.Expression<Typed>;
  };
}

export function constEqual(
  t1: T.Type,
  t2: T.Type,
  source?: TConstraintEqual["source"]
): TConstraintEqual {
  return { tag: "equal-constraint", t1, t2, source };
}

export function constSelfType(
  expr: S.Expression<Typed>,
  selfType: T.Type
): TConstraint {
  return {
    tag: "equal-constraint",
    t1: expr.info.selfType,
    t2: selfType,
    source: {
      expr: expr,
      kind: "self-type",
    },
  };
}

export function constResultingType(
  returningForm: S.Expression<Typed>,
  returnType: T.Type
): TConstraint {
  return {
    tag: "equal-constraint",
    t1: returningForm.info.resultingType,
    t2: returnType,
    source: {
      expr: returningForm,
      kind: "resulting-type",
    },
  };
}

export function constEffect(
  expr: S.Expression<Typed>,
  t: T.Type
): TConstraintEqual {
  return {
    tag: "equal-constraint",
    t1: expr.info.effect,
    t2: t,
    source: {
      kind: "effect",
      expr,
    },
  };
}

export function constExplicitInstance(
  expr: S.Expression<Typed> | undefined,
  type: T.Type,
  typeSchema: T.TypeSchema,
  closedFunctionEffect?: T.Type
): TConstraintExplicitInstance {
  return {
    tag: "explicit-instance-constraint",
    type,
    typeSchema,
    closedFunctionEffect,
    source: expr && { expr },
  };
}

export function constImplicitInstance(
  expr: S.Expression<Typed> | undefined,
  type: T.Type,
  monovars: T.Var[],
  typeToGeneralize: T.Type,
  closedFunctionEffect?: T.Type
): TConstraintImplicitInstance {
  return {
    tag: "implicit-instance-constraint",
    type,
    monovars: monovars.map((v) => v.node.name),
    typeToGeneralize,
    closedFunctionEffect,
    source: expr && {
      expr,
    },
  };
}

export function debugConstraints(constraints: TConstraint[]) {
  constraints.forEach((c) => {
    switch (c.tag) {
      case "equal-constraint":
        return console.log(
          `${
            c.source
              ? pprint(c.source.expr, 40) + " " + c.source.kind + " "
              : "<no expr>"
          }  of type ${printType(c.t1, false)} is ${printType(c.t2, false)}`
        );
      case "implicit-instance-constraint":
        return console.log(
          `${
            c.source ? pprint(c.source.expr, 40) : "<no expr>"
          } of type ${printType(
            c.type,
            false
          )} is implicit instance of ${printType(c.typeToGeneralize, false)}
for monovars ${c.monovars.join(",")}
`
        );
      case "explicit-instance-constraint":
        return console.log(
          `${
            c.source ? pprint(c.source.expr, 40) : "<no expr>"
          } of type ${printType(
            c.type,
            false
          )} is explicit instance of ${printType(c.typeSchema.mono, false)}`
        );
    }
  });
}

// Set of variables that are "active" in a set of constraints. This
// is, all variables except the ones that will be bound in a type
// scheme. This is used to decide which _instance constraint_ of the
// set can be solved first. See `solve`/`solvable` for further info.
function activevars(constraints: TConstraint[]): string[] {
  return flatMap((c) => {
    switch (c.tag) {
      case "equal-constraint":
        return union(listTypeVariables(c.t1), listTypeVariables(c.t2));
      case "implicit-instance-constraint": {
        return union(
          listTypeVariables(c.type),
          intersection(listTypeVariables(c.typeToGeneralize), c.monovars)
        );
      }
      case "explicit-instance-constraint": {
        return union(
          listTypeVariables(c.type),
          difference(listTypeVariables(c.typeSchema.mono), c.typeSchema.tvars)
        );
      }
    }
  }, constraints);
}

function substituteVar(tvarname: string, s: Substitution): string[] {
  const tv = T.var(tvarname);
  return listTypeVariables(applySubstitution(tv, s));
}

// Remove some variables from a substitution
function removeSubstitution(s: Substitution, removeVars: string[]) {
  const output: Substitution = {};
  for (const v in s) {
    if (!removeVars.includes(v)) {
      output[v] = s[v];
    }
  }
  return output;
}

// Apply a substitution to a polytype, replacing only free variables
// from the polytype.
function applySubstitutionToPolytype(
  t: T.TypeSchema,
  s: Substitution
): T.TypeSchema {
  return new T.TypeSchema(
    t.tvars,
    applySubstitution(t.mono, removeSubstitution(s, t.tvars))
  );
}

function applySubstitutionToConstraint(
  c: TConstraint,
  s: Substitution
): TConstraint {
  switch (c.tag) {
    case "equal-constraint":
      return {
        tag: "equal-constraint",
        t1: applySubstitution(c.t1, s),
        t2: applySubstitution(c.t2, s),
        source: c.source,
      };
    case "implicit-instance-constraint":
      return {
        tag: "implicit-instance-constraint",
        type: applySubstitution(c.type, s),
        typeToGeneralize: applySubstitution(c.typeToGeneralize, s),
        monovars: flatMap((name) => substituteVar(name, s), c.monovars),
        source: c.source,
        closedFunctionEffect:
          c.closedFunctionEffect &&
          applySubstitution(c.closedFunctionEffect, s),
      };
    case "explicit-instance-constraint":
      return {
        tag: "explicit-instance-constraint",
        type: applySubstitution(c.type, s),
        typeSchema: applySubstitutionToPolytype(c.typeSchema, s),
        source: c.source,
        closedFunctionEffect:
          c.closedFunctionEffect &&
          applySubstitution(c.closedFunctionEffect, s),
      };
  }
}

// Solve the set of constraints generated by `infer`, returning a substitution that
// can be applied to the temporary types to get the principal type of the expression.
export function solve(
  constraints: TConstraint[],
  solution: Substitution
): Substitution {
  if (constraints.length === 0) {
    return solution;
  }

  // Check if a constraint is solvable.
  //
  // Equality constraints can be solved by ordinary
  // unification. However, instance constraints must be resolved in an
  // specific order. We must find a constraint that is _solvable_.
  //
  // Implicit instance constraint are solvable if they generalize over
  // variables that are not active in the rest of the constraints. So
  // we know how to generalize it.
  //
  // TODO: This can be made more efficient by studing the dependency
  // between the constraints
  function solvable(c: TConstraint): boolean {
    switch (c.tag) {
      case "equal-constraint":
      case "explicit-instance-constraint":
        return true;
      case "implicit-instance-constraint":
        const others = constraints.filter((c1) => c !== c1);
        const result =
          intersection(
            difference(listTypeVariables(c.typeToGeneralize), c.monovars),
            activevars(others)
          ).length === 0;
        return result;
    }
  }

  const constraint = constraints.find(solvable);

  if (constraint === undefined) {
    throw new Error(`circular dependency between constraints detected`);
  }

  if (DEBUG) {
    console.log(`---- Solving ----`);
    console.log("with partial solution");
    console.log("");
    Object.keys(solution).forEach((v) => {
      console.log(`${v} => ${printType(solution[v], false)}`);
    });
    console.log("current constraint:");
    debugConstraints([constraint]);
    console.log("between other constraints");
    debugConstraints(constraints.filter((c) => c !== constraint));
    console.log("");
    console.log(">>>>>>>>>>>>>");
  }

  const rest = constraints.filter((c) => c !== constraint);

  const solveEq = (exprType: T.Type, t: T.Type) => {
    const result = unify(exprType, t, solution);
    switch (result.tag) {
      case "unify-success": {
        const s = result.substitution;
        return solve(
          rest.map((c) => applySubstitutionToConstraint(c, s)),
          s
        );
      }
      case "unify-occur-check-error": {
        throw new Error(
          printHighlightedExpr(
            "Expression would have an infinity type",
            constraint.source && constraint.source.expr.location
          )
        );
      }

      case "unify-mismatch-error":
        throw new Error(
          printHighlightedExpr(
            `Type mismatch

Expected ${printType(
              applySubstitution(result.t2, solution),
              false
            )} instead of ${printType(
              applySubstitution(result.t1, solution),
              false
            )}

Expression had type

  ${printType(applySubstitution(exprType, solution), false)}

but we expected the type

  ${printType(applySubstitution(t, solution), false)}
`,

            constraint.source && constraint.source.expr.location
          )
        );
      case "unify-missing-value-error":
        throw new Error(
          printHighlightedExpr(
            `Type mismatch

Missing value of type ${printType(applySubstitution(result.t, solution), false)}

${printType(applySubstitution(t, solution), false)}

vs.

${printType(applySubstitution(exprType, solution), false)}

`,
            constraint.source && constraint.source.expr.location
          )
        );
      default:
        return assertNever(result);
    }
  };

  switch (constraint.tag) {
    case "equal-constraint": {
      return solveEq(constraint.t1, constraint.t2);
    }
    case "explicit-instance-constraint": {
      const closedType = instantiate(
        closeFunctionEffect(constraint.typeSchema)
      );
      const openedType = openFunctionEffect(closedType);
      return solve(
        [
          constEqual(constraint.type, openedType),
          ...(constraint.closedFunctionEffect
            ? [constEqual(constraint.closedFunctionEffect, closedType)]
            : []),
          ...rest,
        ],
        solution
      );
    }
    case "implicit-instance-constraint": {
      const t = generalize(constraint.typeToGeneralize, constraint.monovars);
      return solve(
        [
          constExplicitInstance(
            constraint.source && constraint.source.expr,
            constraint.type,
            t,
            constraint.closedFunctionEffect
          ),
          ...rest,
        ],
        solution
      );
    }
  }
}

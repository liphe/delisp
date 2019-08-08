import { printHighlightedExpr } from "./error-report";
import {
  applyTypeSubstitutionToVariable,
  applySubstitutionToExpr
} from "./infer-subst";
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
  openFunctionEffect
} from "./type-utils";
import * as T from "./types";
import { unify } from "./type-unify";
import { difference, flatMap, intersection, union } from "./utils";

// A TAssumption is a variable instance for which we have assumed the
// type. Those variables are to be bound (and assumption removed)
// later, either by `let`, `lambda`, or global definitions.  Note: it
// is normal to have multiple assumptions (instances) for the same
// variable. Assumptions will be converted to additional constraints
// at the end of the inference process.
export type TAssumption = {
  variable: S.SVariableReference<Typed>;
};

type ConstraintKind = "expression-type" | "resulting-type" | "effect-type";

// Constraints impose which types should be equal (unified) and which
// types are instances of other types.
export type TConstraint =
  | TConstraintEqual
  | TConstraintImplicitInstance
  | TConstraintExplicitInstance;

function constraintExpression(c: TConstraint): S.Expression<Typed> {
  return c.tag === "equal-constraint" ? c.expr : c.assumption.variable;
}

// A constraint stating that an expression's type should be equal to a
// given type.
interface TConstraintEqual {
  tag: "equal-constraint";
  kind: ConstraintKind;
  expr: S.Expression<Typed>;
  t: T.Type;
}
export function constEqual(
  expr: S.Expression<Typed>,
  t: T.Type,
  kind: ConstraintKind
): TConstraintEqual {
  return { tag: "equal-constraint", expr, t, kind };
}

export function constEffect(
  expr: S.Expression<Typed>,
  t: T.Type
): TConstraintEqual {
  return constEqual(expr, t, "effect-type");
}

// A constriant stating that an expression's type is an instance of
// the (poly)type t.  This is generated when we already know somehow
// the generalized type of an expression. For example if the user has
// provided some type annotations.
interface TConstraintExplicitInstance {
  tag: "explicit-instance-constraint";
  assumption: TAssumption;
  t: T.TypeSchema;
}
export function constExplicitInstance(
  assumption: TAssumption,
  t: T.TypeSchema
): TConstraintExplicitInstance {
  return {
    tag: "explicit-instance-constraint",
    assumption,
    t
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
  assumption: TAssumption;
  t: T.Type;
  monovars: string[];
}

export function constImplicitInstance(
  assumption: TAssumption,
  monovars: T.Var[],
  t: T.Type
): TConstraintImplicitInstance {
  return {
    tag: "implicit-instance-constraint",
    assumption,
    monovars: monovars.map(v => v.node.name),
    t
  };
}

function exprType(expr: S.Expression<Typed>, kind: ConstraintKind) {
  switch (kind) {
    case "resulting-type":
      return expr.info.resultingType;
    case "expression-type":
      return expr.info.expressionType;
    case "effect-type":
      return expr.info.effect;
  }
}

export function debugConstraints(constraints: TConstraint[]) {
  constraints.forEach(c => {
    switch (c.tag) {
      case "equal-constraint":
        return console.log(
          `${pprint(c.expr, 40)} ${c.kind} of type ${printType(
            exprType(c.expr, c.kind),
            false
          )} is ${printType(c.t, false)}`
        );
      case "implicit-instance-constraint":
        return console.log(
          `${pprint(
            c.assumption.variable,
            40
          )} is implicit instance of ${printType(c.t, false)}`
        );
      case "explicit-instance-constraint":
        return console.log(
          `${pprint(
            c.assumption.variable,
            40
          )} is explicit instance of ${printType(c.t.mono, false)}`
        );
    }
  });
}

// Set of variables that are "active" in a set of constraints. This
// is, all variables except the ones that will be bound in a type
// scheme. This is used to decide which _instance constraint_ of the
// set can be solved first. See `solve`/`solvable` for further info.
function activevars(constraints: TConstraint[]): string[] {
  const equal = (t1: T.Type, t2: T.Type) => {
    return union(listTypeVariables(t1), listTypeVariables(t2));
  };

  return flatMap(c => {
    switch (c.tag) {
      case "equal-constraint":
        return equal(exprType(c.expr, c.kind), c.t);
      case "implicit-instance-constraint":
        return union(
          listTypeVariables(exprType(c.assumption.variable, "expression-type")),
          intersection(listTypeVariables(c.t), c.monovars)
        );
      case "explicit-instance-constraint":
        return union(
          listTypeVariables(exprType(c.assumption.variable, "expression-type")),
          difference(listTypeVariables(c.t.mono), c.t.tvars)
        );
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
        expr: applySubstitutionToExpr(c.expr, s),
        t: applySubstitution(c.t, s),
        kind: c.kind
      };
    case "implicit-instance-constraint":
      return {
        tag: "implicit-instance-constraint",
        assumption: {
          variable: applyTypeSubstitutionToVariable(c.assumption.variable, s)
        },
        t: applySubstitution(c.t, s),
        monovars: flatMap(name => substituteVar(name, s), c.monovars)
      };
    case "explicit-instance-constraint":
      return {
        tag: "explicit-instance-constraint",
        assumption: {
          variable: applyTypeSubstitutionToVariable(c.assumption.variable, s)
        },
        t: applySubstitutionToPolytype(c.t, s)
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
        const others = constraints.filter(c1 => c !== c1);
        return (
          intersection(
            difference(listTypeVariables(c.t), c.monovars),
            activevars(others)
          ).length === 0
        );
    }
  }

  const constraint = constraints.find(solvable);
  if (constraint === undefined) {
    throw new Error(`circular dependency between constraints detected`);
  }

  const rest = constraints.filter(c => c !== constraint);

  const solveEq = (exprType: T.Type, t: T.Type) => {
    const result = unify(exprType, t, solution);
    switch (result.tag) {
      case "unify-success": {
        const s = result.substitution;
        return solve(rest.map(c => applySubstitutionToConstraint(c, s)), s);
      }
      case "unify-occur-check-error": {
        throw new Error(
          printHighlightedExpr(
            "Expression would have an infinity type",
            constraint.tag === "equal-constraint"
              ? constraint.expr.location
              : constraint.assumption.variable.location
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

${printType(applySubstitution(t, solution), false)}

vs.

${printType(applySubstitution(exprType, solution), false)}`,

            constraintExpression(constraint).location
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
            constraintExpression(constraint).location
          )
        );
      default:
        return assertNever(result);
    }
  };

  switch (constraint.tag) {
    case "equal-constraint": {
      return solveEq(exprType(constraint.expr, constraint.kind), constraint.t);
    }
    case "explicit-instance-constraint": {
      return solve(
        [
          constEqual(
            constraint.assumption.variable,
            openFunctionEffect(instantiate(constraint.t)),
            "expression-type"
          ),
          ...rest
        ],
        solution
      );
    }
    case "implicit-instance-constraint": {
      const t = generalize(constraint.t, constraint.monovars);
      return solve(
        [constExplicitInstance(constraint.assumption, t), ...rest],
        solution
      );
    }
  }
}

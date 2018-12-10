//
// This module implements type inference
//
// It is based on the paper "Generalizing Hindley-Milner Type Inference
// Algorithms", by Bastiaan Heeren, Jurriaan Hage and Doaitse Swierstra.
//
// You can find it online at
//
//   https://pdfs.semanticscholar.org/8983/233b3dff2c5b94efb31235f62bddc22dc899.pdf
//

import { Expression, functionArgs, SVar } from "./syntax";
import {
  generalize,
  generateUniqueTVar,
  instantiate,
  listTypeVariables
} from "./type-utils";
import { Monotype, TApplication, TNumber, TString, TVar, Type } from "./types";
import { applySubstitution, Substitution, unify } from "./unify";
import { difference, flatten, intersection, union, unique } from "./utils";

interface TConstraintEqual {
  type: "equal-constraint";
  t1: Monotype;
  t2: Monotype;
}

interface TConstraintImplicitInstance {
  type: "implicit-instance-constraint";
  t1: Monotype;
  t2: Monotype;
  monovars: string[];
}

interface TConstraintExplicitInstance {
  type: "explicit-instance-constraint";
  t1: Monotype;
  t2: Type;
}

type TConstraint =
  | TConstraintEqual
  | TConstraintImplicitInstance
  | TConstraintExplicitInstance;
type TAssumption = [SVar, Monotype];

function constEqual(t1: Monotype, t2: Monotype): TConstraintEqual {
  return { type: "equal-constraint", t1, t2 };
}

function constImplicitInstance(
  t1: Monotype,
  monovars: string[],
  t2: Monotype
): TConstraintImplicitInstance {
  return { type: "implicit-instance-constraint", t1, monovars, t2 };
}

function constExplicitInstance(
  t1: Monotype,
  t2: Type
): TConstraintExplicitInstance {
  return { type: "explicit-instance-constraint", t1, t2 };
}

function substituteVar(tvarname: string, s: Substitution): string[] {
  const tv: TVar = { type: "type-variable", name };
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
function applySubstitutionToPolytype(t: Type, s: Substitution): Type {
  return {
    type: "type",
    tvars: t.tvars,
    mono: applySubstitution(t.mono, removeSubstitution(s, t.tvars))
  };
}

function applySubstitutionToConstraint(
  c: TConstraint,
  s: Substitution
): TConstraint {
  switch (c.type) {
    case "equal-constraint":
      return {
        type: "equal-constraint",
        t1: applySubstitution(c.t1, s),
        t2: applySubstitution(c.t2, s)
      };
    case "implicit-instance-constraint":
      return {
        type: "implicit-instance-constraint",
        t1: applySubstitution(c.t1, s),
        t2: applySubstitution(c.t2, s),
        monovars: flatten(c.monovars.map(name => substituteVar(name, s)))
      };
    case "explicit-instance-constraint":
      return {
        type: "explicit-instance-constraint",
        t1: applySubstitution(c.t1, s),
        t2: applySubstitutionToPolytype(c.t2, s)
      };
  }
}

function infer(
  syntax: Expression,
  // A set of type variables names whose type is monomorphic. That is
  // to say, all instances should have the same type. That is the set
  // of type variables introduced by lambda.
  monovars: string[]
): { type: Monotype; constraints: TConstraint[]; assumptions: TAssumption[] } {
  switch (syntax.type) {
    case "number":
      return { type: { type: "number" }, constraints: [], assumptions: [] };
    case "string":
      return { type: { type: "string" }, constraints: [], assumptions: [] };
    case "variable-reference": {
      const t = generateUniqueTVar();
      return {
        type: t,
        constraints: [],
        assumptions: [[syntax.variable, t]]
      };
    }
    case "function": {
      const fnargs = functionArgs(syntax);
      const argtypes = fnargs.map(_ => generateUniqueTVar());

      const { type, constraints, assumptions } = infer(syntax.body, [
        ...monovars,
        ...argtypes.map(v => v.name)
      ]);

      const newConstraints: TConstraint[] = [
        ...assumptions
          .filter(([v, _]) => fnargs.includes(v))
          .map(([v, t]) => {
            const varIndex = fnargs.indexOf(v);
            return constEqual(t, argtypes[varIndex]);
          })
      ];
      return {
        type: {
          type: "application",
          op: "->",
          args: [...argtypes, type]
        },
        constraints: constraints.concat(newConstraints),
        assumptions: assumptions.filter(([v, _]) => !fnargs.includes(v))
      };
    }
    case "function-call": {
      const ifn = infer(syntax.fn, monovars);
      const iargs = syntax.args.map(arg => infer(arg, monovars));
      const tTo = generateUniqueTVar();

      const tfn: Monotype = {
        type: "application",
        op: "->",
        args: [...iargs.map(a => a.type), tTo]
      };

      return {
        type: tTo,
        constraints: ([
          { type: "equal-constraint", t1: ifn.type, t2: tfn }
        ] as TConstraint[]).concat(
          ...ifn.constraints,
          ...iargs.map(a => a.constraints)
        ),
        assumptions: ifn.assumptions.concat(...iargs.map(a => a.assumptions))
      };
    }

    case "let-bindings": {
      // Variables showing up in the bindings
      const vars = new Set(syntax.bindings.map(b => b.var));
      const toBeBound = (vname: string) => vars.has(vname);

      const bindingsInfo = syntax.bindings.map(b => {
        return {
          ...b,
          inference: infer(b.value, monovars)
        };
      });
      const bodyInference = infer(syntax.body, monovars);
      return {
        type: bodyInference.type,
        constraints: [
          ...bodyInference.constraints,
          ...flatten(bindingsInfo.map(i => i.inference.constraints)),
          // For each variable in the binding list, we have to add
          // constraints that state that all the assumed types for the
          // variable until now in the body are actually instances of
          // the generalized polytype of the value to be bound.
          ...bodyInference.assumptions
            // Consider variables to be bound
            .filter(([v, _]) => toBeBound(v))
            .map(([v, t]) => {
              // We just filter the assumptions to the variables
              // that are bound, so we know it must is defined.
              const bInfo = bindingsInfo.find(bi => bi.var === v)!;
              return constImplicitInstance(t, monovars, bInfo.inference.type);
            })
        ],
        assumptions: [
          ...bodyInference.assumptions.filter(([v, _]) => !toBeBound(v)),
          ...flatten(bindingsInfo.map(bi => bi.inference.assumptions))
        ]
      };
    }
  }
}

export interface TypeEnvironment {
  [v: string]: Type;
}

function assumptionsToConstraints(
  assumptions: TAssumption[],
  typeEnvironment: TypeEnvironment
): TConstraint[] {
  return flatten(
    Object.keys(typeEnvironment).map(v =>
      assumptions
        .filter(([aVar, aType]) => aVar === v)
        .map(([_, aType]) => constExplicitInstance(aType, typeEnvironment[v]))
    )
  );
}

// Set of variables that are "active" in a set of constraints. This
// is, all variables except the ones that will be bound in a type
// scheme. This is used to decide which instance constraint of the set
// can be solved first.
function activevars(constraints: TConstraint[]): string[] {
  return flatten(
    constraints.map(c => {
      switch (c.type) {
        case "equal-constraint":
          return union(listTypeVariables(c.t1), listTypeVariables(c.t2));
        case "implicit-instance-constraint":
          return union(
            listTypeVariables(c.t1),
            intersection(listTypeVariables(c.t2), c.monovars)
          );
        case "explicit-instance-constraint":
          return union(
            listTypeVariables(c.t1),
            difference(listTypeVariables(c.t2.mono), c.t2.tvars)
          );
      }
    })
  );
}

// Solve the set of constraints generated by `infer`, returning a substitution that
// can be applied to the temporary types to get the principal type of the expression.
function solve(
  constraints: TConstraint[],
  solution: Substitution = {}
): Substitution {
  if (constraints.length === 0) {
    return solution;
  }

  // Check if a constraint is solvable.
  //
  // Equality constraints can be solved by ordinary
  // unification. However, instance constraints must be resolved in an
  // specific order. We must find a constraint that is solvable...
  // TODO: This can be made more efficient by studing the dependency
  // between the constraints
  function solvable(c: TConstraint): boolean {
    switch (c.type) {
      case "equal-constraint":
      case "explicit-instance-constraint":
        return true;
      case "implicit-instance-constraint":
        const others = constraints.filter(c1 => c !== c1);
        return (
          intersection(
            difference(listTypeVariables(c.t2), c.monovars),
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

  switch (constraint.type) {
    case "equal-constraint": {
      const s = unify(constraint.t1, constraint.t2, solution);
      return solve(rest.map(c => applySubstitutionToConstraint(c, s)), s);
    }
    case "explicit-instance-constraint": {
      return solve(
        [constEqual(constraint.t1, instantiate(constraint.t2)), ...rest],
        solution
      );
    }
    case "implicit-instance-constraint": {
      const t = generalize(constraint.t2, constraint.monovars);
      return solve(
        [constExplicitInstance(constraint.t1, t), ...rest],
        solution
      );
    }
  }
}

export function inferType(
  expr: Expression,
  typeEnvironment: TypeEnvironment = {}
): Monotype {
  const { type, constraints, assumptions } = infer(expr, []);
  const s = solve([
    ...constraints,
    ...assumptionsToConstraints(assumptions, typeEnvironment)
  ]);
  return applySubstitution(type, s);
}

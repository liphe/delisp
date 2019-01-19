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

import {
  Expression,
  functionArgs,
  isDeclaration,
  Module,
  SVariableReference,
  Syntax
} from "./syntax";

import { printHighlightedExpr } from "./error-report";

import { applySubstitution, Substitution } from "./type-substitution";
import {
  generalize,
  generateUniqueTVar,
  instantiate,
  listTypeVariables
} from "./type-utils";
import { Monotype, TVar, Type } from "./types";
import { unify } from "./unify";
import { difference, flatten, intersection, mapObject, union } from "./utils";

import { getInlinePrimitiveTypes } from "./compiler/inline-primitives";

import primitives from "./primitives";

// The type inference process is split in two stages. Firstly, `infer`
// will run through the syntax it will generate dummy type variables,
// together with a set of constraints and assumptions.
//

// A TAssumption is a variable instance for which we have assumed the
// type. Those variables are to be bound (and assumption removed)
// later, either by `let`, `lambda`, or global definitions.  Note: it
// is normal to have multiple assumptions (instances) for the same
// variable. Assumptions will be converted to additional constraints
// at the end of the inference process.
type TAssumption = SVariableReference<Typed>;

// Constraints impose which types should be equal (unified) and which
// types are instances of other types.
type TConstraint =
  | TConstraintEqual
  | TConstraintImplicitInstance
  | TConstraintExplicitInstance;

// A constraint stating that an expression's type should be equal to a
// given type.
interface TConstraintEqual {
  type: "equal-constraint";
  expr: Expression<Typed>;
  t: Monotype;
}
function constEqual(expr: Expression<Typed>, t: Monotype): TConstraintEqual {
  return { type: "equal-constraint", expr, t };
}

// A constriant stating that an expression's type is an instance of
// the (poly)type t.  This is generated when we already know somehow
// the generalized type of an expression. For example if the user has
// provided some type annotations.
interface TConstraintExplicitInstance {
  type: "explicit-instance-constraint";
  expr: Expression<Typed>;
  t: Type;
}
function constExplicitInstance(
  expr: Expression<Typed>,
  t: Type
): TConstraintExplicitInstance {
  return { type: "explicit-instance-constraint", expr, t };
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
  type: "implicit-instance-constraint";
  expr: Expression<Typed>;
  t: Monotype;
  monovars: string[];
}

function constImplicitInstance(
  expr: Expression<Typed>,
  monovars: string[],
  t: Monotype
): TConstraintImplicitInstance {
  return { type: "implicit-instance-constraint", expr, monovars, t };
}

export interface Typed {
  type: Monotype;
}

// Generate new types for an expression an all its subexpressions,
// returning and a set of constraints and assumptions between them.
function infer(
  expr: Expression,
  // A set of type variables names whose type is monomorphic. That is
  // to say, all instances should have the same type. That is the set
  // of type variables introduced by lambda.
  monovars: string[]
): {
  expr: Expression<Typed>;
  constraints: TConstraint[];
  assumptions: TAssumption[];
} {
  switch (expr.type) {
    case "number":
      return {
        expr: { ...expr, info: { type: { type: "number" } } },
        constraints: [],
        assumptions: []
      };
    case "string":
      return {
        expr: { ...expr, info: { type: { type: "string" } } },
        constraints: [],
        assumptions: []
      };
    case "variable-reference": {
      // as we found a variable, and because we lack an
      // 'environment/context', we generate a new type and add an
      // assumption for this variable.
      const t = generateUniqueTVar();
      const typedVar = {
        ...expr,
        info: {
          type: t
        }
      };
      return {
        expr: typedVar,
        constraints: [],
        assumptions: [typedVar]
      };
    }
    case "conditional": {
      const condition = infer(expr.condition, monovars);
      const consequent = infer(expr.consequent, monovars);
      const alternative = infer(expr.alternative, monovars);
      const t = generateUniqueTVar();

      return {
        expr: {
          ...expr,
          condition: condition.expr,
          consequent: consequent.expr,
          alternative: alternative.expr,
          info: {
            type: t
          }
        },
        assumptions: [
          ...condition.assumptions,
          ...consequent.assumptions,
          ...alternative.assumptions
        ],
        constraints: [
          ...condition.constraints,
          ...consequent.constraints,
          ...alternative.constraints,
          constEqual(condition.expr, { type: "boolean" }),
          constEqual(consequent.expr, t),
          constEqual(alternative.expr, t)
        ]
      };
    }
    case "function": {
      const fnargs = functionArgs(expr);
      const argtypes = fnargs.map(_ => generateUniqueTVar());

      const { expr: typedBody, constraints, assumptions } = infer(expr.body, [
        ...monovars,
        ...argtypes.map(v => v.name)
      ]);

      // Generate a constraint for each assumption pending for each
      // argument, stating that they are equal to the argument types
      // the new function type we have created.
      const newConstraints: TConstraint[] = [
        ...assumptions
          .filter(v => fnargs.includes(v.name))
          .map(v => {
            const varIndex = fnargs.indexOf(v.name);
            return constEqual(v, argtypes[varIndex]);
          })
      ];
      return {
        expr: {
          ...expr,
          body: typedBody,
          info: {
            type: {
              type: "application",
              op: "->",
              args: [...argtypes, typedBody.info.type]
            }
          }
        },
        constraints: constraints.concat(newConstraints),
        // assumptions have already been used, so they can be deleted.
        assumptions: assumptions.filter(v => !fnargs.includes(v.name))
      };
    }
    case "function-call": {
      const ifn = infer(expr.fn, monovars);
      const iargs = expr.args.map(arg => infer(arg, monovars));
      const tTo = generateUniqueTVar();

      const tfn: Monotype = {
        type: "application",
        op: "->",
        args: [...iargs.map(a => a.expr.info.type), tTo]
      };

      return {
        expr: {
          ...expr,
          fn: ifn.expr,
          args: iargs.map(a => a.expr),
          info: { type: tTo }
        },
        constraints: ([constEqual(ifn.expr, tfn)] as TConstraint[]).concat(
          ...ifn.constraints,
          ...iargs.map(a => a.constraints)
        ),
        assumptions: ifn.assumptions.concat(...iargs.map(a => a.assumptions))
      };
    }

    case "let-bindings": {
      // let introduces complexities, as it is where let-polymorphism
      // happens. That is, the monotypes of the values are generalized
      // to polytypes.
      //
      // That means that, for example,
      //
      // (let ((id (lambda (x) x)))
      //   (id "foo")
      //   (id 0))
      //
      // is valid. The type of the identity function is generalized
      // from a0->a0 to a schema forall a. a -> a.  So each usage of
      // `id` in the body is constrainted to be an instance (and not
      // equal) of this type.
      //

      // Variables showing up in the bindings
      const vars = new Set(expr.bindings.map(b => b.var));
      const toBeBound = (vname: string) => vars.has(vname);

      const bindingsInfo = expr.bindings.map(b => {
        return {
          binding: b,
          inference: infer(b.value, monovars)
        };
      });
      const bodyInference = infer(expr.body, monovars);
      return {
        expr: {
          ...expr,
          bindings: bindingsInfo.map(b => ({
            ...b.binding,
            value: b.inference.expr
          })),
          body: bodyInference.expr,
          info: {
            type: bodyInference.expr.info.type
          }
        },
        constraints: [
          ...bodyInference.constraints,
          ...flatten(bindingsInfo.map(i => i.inference.constraints)),
          // For each variable in the binding list, we have to add
          // constraints that state that all the assumed types for the
          // variable until now in the body are actually instances of
          // the generalized polytype of the value to be bound.
          ...bodyInference.assumptions
            // Consider variables to be bound
            .filter(v => toBeBound(v.name))
            .map(v => {
              // We just filter the assumptions to the variables
              // that are bound, so we know it must is defined.
              const bInfo = bindingsInfo.find(bi => bi.binding.var === v.name)!;
              return constImplicitInstance(
                v,
                monovars,
                bInfo.inference.expr.info.type
              );
            })
        ],
        assumptions: [
          ...bodyInference.assumptions.filter(v => !toBeBound(v.name)),
          ...flatten(bindingsInfo.map(bi => bi.inference.assumptions))
        ]
      };
    }
  }
}

function inferSyntax(
  syntax: Syntax
): {
  syntax: Syntax<Typed>;
  constraints: TConstraint[];
  assumptions: TAssumption[];
} {
  if (isDeclaration(syntax)) {
    const { expr, assumptions, constraints } = infer(syntax.value, []);
    return {
      syntax: {
        ...syntax,
        value: expr
      },
      assumptions,
      constraints
    };
  } else {
    const { expr, assumptions, constraints } = infer(syntax, []);
    return {
      syntax: expr,
      assumptions,
      constraints
    };
  }
}

// Constraint solver
//
// Resolving a set of constraints means finding a Substitution that
// will satisfy all the constraints. This substitution can be applied
// to all temporary types introduced by the inference to the the
// "real" types.
//

// Before we solve the constraints, we have to get rid of the leftover
// assumptions. Those assumptions are from variables we have not
// found, so they are supposed to be part of a global environment (or
// non existing!).
export interface TypeEnvironment {
  [v: string]: Type;
}
// Generate constraints for those assumptions. Note that we generate
// explicit instance constraints, as it will allow us to have
// polymoprphic types in the environment.
function assumptionsToConstraints(
  assumptions: TAssumption[],
  typeEnvironment: TypeEnvironment
): TConstraint[] {
  return flatten(
    Object.keys(typeEnvironment).map(v =>
      assumptions
        .filter(aVar => aVar.name === v)
        .map(aVar => constExplicitInstance(aVar, typeEnvironment[v]))
    )
  );
}

// Set of variables that are "active" in a set of constraints. This
// is, all variables except the ones that will be bound in a type
// scheme. This is used to decide which _instance constraint_ of the
// set can be solved first. See `solve`/`solvable` for further info.
function activevars(constraints: TConstraint[]): string[] {
  return flatten(
    constraints.map(c => {
      switch (c.type) {
        case "equal-constraint":
          return union(
            listTypeVariables(c.expr.info.type),
            listTypeVariables(c.t)
          );
        case "implicit-instance-constraint":
          return union(
            listTypeVariables(c.expr.info.type),
            intersection(listTypeVariables(c.t), c.monovars)
          );
        case "explicit-instance-constraint":
          return union(
            listTypeVariables(c.expr.info.type),
            difference(listTypeVariables(c.t.mono), c.t.tvars)
          );
      }
    })
  );
}

function substituteVar(tvarname: string, s: Substitution): string[] {
  const tv: TVar = { type: "type-variable", name: tvarname };
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
        expr: applySubstitutionToExpr(c.expr, s),
        t: applySubstitution(c.t, s)
      };
    case "implicit-instance-constraint":
      return {
        type: "implicit-instance-constraint",
        expr: applySubstitutionToExpr(c.expr, s),
        t: applySubstitution(c.t, s),
        monovars: flatten(c.monovars.map(name => substituteVar(name, s)))
      };
    case "explicit-instance-constraint":
      return {
        type: "explicit-instance-constraint",
        expr: applySubstitutionToExpr(c.expr, s),
        t: applySubstitutionToPolytype(c.t, s)
      };
  }
}

function applySubstitutionToExpr(
  s: Expression<Typed>,
  env: Substitution
): Expression<Typed> {
  switch (s.type) {
    case "string":
    case "number":
    case "variable-reference":
      return {
        ...s,
        info: {
          ...s.info,
          type: applySubstitution(s.info.type, env)
        }
      };
    case "function-call":
      return {
        ...s,
        fn: applySubstitutionToExpr(s.fn, env),
        args: s.args.map(a => applySubstitutionToExpr(a, env)),
        info: {
          ...s.info,
          type: applySubstitution(s.info.type, env)
        }
      };
    case "conditional":
      return {
        ...s,
        condition: applySubstitutionToExpr(s.condition, env),
        consequent: applySubstitutionToExpr(s.consequent, env),
        alternative: applySubstitutionToExpr(s.alternative, env),
        info: {
          ...s.info,
          type: applySubstitution(s.info.type, env)
        }
      };
    case "function":
      return {
        ...s,
        body: applySubstitutionToExpr(s.body, env),
        info: {
          ...s.info,
          type: applySubstitution(s.info.type, env)
        }
      };
    case "let-bindings":
      return {
        ...s,
        bindings: s.bindings.map(b => ({
          ...b,
          value: applySubstitutionToExpr(b.value, env)
        })),
        body: applySubstitutionToExpr(s.body, env),
        info: {
          ...s.info,
          type: applySubstitution(s.info.type, env)
        }
      };
  }
}

function applySubstitutionToSyntax(
  s: Syntax<Typed>,
  env: Substitution
): Syntax<Typed> {
  if (isDeclaration(s)) {
    return {
      ...s,
      value: applySubstitutionToExpr(s.value, env)
    };
  } else {
    return applySubstitutionToExpr(s, env);
  }
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
  // specific order. We must find a constraint that is _solvable_.
  //
  // Implicit instance constraint are solvable if they generalize over
  // variables that are not active in the rest of the constraints. So
  // we know how to generalize it.
  //
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

  switch (constraint.type) {
    case "equal-constraint": {
      const result = unify(constraint.expr.info.type, constraint.t, solution);

      switch (result.type) {
        case "unify-success": {
          const s = result.substitution;
          return solve(rest.map(c => applySubstitutionToConstraint(c, s)), s);
        }
        case "unify-occur-check-error":
          throw new Error(
            printHighlightedExpr(
              "Expression would have an infinity type",
              constraint.expr.location
            )
          );
        case "unify-mismatch-error":
          throw new Error(
            printHighlightedExpr("Type mismatch", constraint.expr.location)
          );
        default:
          // Adding a default clause here makes Typescript detects
          // that this case won't fall through to the next one.
          throw new Error(`can't happen`);
      }
    }
    case "explicit-instance-constraint": {
      return solve(
        [constEqual(constraint.expr, instantiate(constraint.t)), ...rest],
        solution
      );
    }
    case "implicit-instance-constraint": {
      const t = generalize(constraint.t, constraint.monovars);
      return solve(
        [constExplicitInstance(constraint.expr, t), ...rest],
        solution
      );
    }
  }
}

const defaultTypeEnvironment: TypeEnvironment = {
  ...getInlinePrimitiveTypes(),
  ...mapObject(primitives, prim => prim.type)
};

export function inferType(
  expr: Expression,
  typeEnvironment: TypeEnvironment = defaultTypeEnvironment
): Expression<Typed> {
  const { expr: tmpExpr, constraints, assumptions } = infer(expr, []);

  const s = solve([
    ...constraints,
    ...assumptionsToConstraints(assumptions, typeEnvironment)
  ]);

  return applySubstitutionToExpr(tmpExpr, s);
}

function groupAssumptions(
  assumptions: TAssumption[],
  internalEnv: { [v: string]: Monotype },
  externalEnv: TypeEnvironment
): {
  internals: TAssumption[];
  externals: TAssumption[];
  unknowns: TAssumption[];
} {
  const internals = assumptions.filter(v => v.name in internalEnv);
  const externals = assumptions.filter(v => v.name in externalEnv);
  return {
    internals,
    externals,
    unknowns: difference(assumptions, [...internals, ...externals])
  };
}

export function inferModule(
  m: Module,
  externalEnv: TypeEnvironment = defaultTypeEnvironment
): {
  typedModule: Module<Typed>;
  unknowns: TAssumption[];
} {
  const bodyInferences = m.body.map(inferSyntax);
  const body = bodyInferences.map(i => i.syntax);

  const internalEnv: {
    [v: string]: Monotype;
  } = body.reduce((env, s) => {
    if (isDeclaration(s)) {
      return { ...env, [s.variable]: s.value.info.type };
    } else {
      return env;
    }
  }, {});

  const assumptions = groupAssumptions(
    flatten(bodyInferences.map(i => i.assumptions)),
    internalEnv,
    externalEnv
  );

  const constraints: TConstraint[] = [
    ...flatten(bodyInferences.map(i => i.constraints)),

    ...assumptionsToConstraints(assumptions.externals, externalEnv),

    ...assumptions.internals.map(v =>
      constImplicitInstance(v, [], internalEnv[v.name])
    )
  ];

  const solution = solve(constraints);

  return {
    typedModule: {
      ...m,
      body: body.map(s => applySubstitutionToSyntax(s, solution))
    },
    unknowns: assumptions.unknowns.map(
      (v): TAssumption => {
        return applySubstitutionToExpr(v, solution) as SVariableReference<
          Typed
        >;
      }
    )
  };
}

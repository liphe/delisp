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

import { Expression, Module, SVariableReference, Syntax } from "./syntax";

import { printType } from "./type-utils";

import { printHighlightedExpr } from "./error-report";

import { generateUniqueTVar } from "./type-generate";
import { applySubstitution, Substitution } from "./type-substitution";
import { generalize, instantiate, listTypeVariables } from "./type-utils";

import {
  emptyRow,
  Monotype,
  tBoolean,
  tFn,
  tNumber,
  tRecord,
  tString,
  tVar,
  tVector,
  Type
} from "./types";
import { unify } from "./unify";
import {
  difference,
  flatMap,
  intersection,
  last,
  mapObject,
  maybeMap,
  union
} from "./utils";

import {
  findInlinePrimitive,
  isInlinePrimitive
} from "./compiler/inline-primitives";

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
  userSpecified: boolean;
}
function constExplicitInstance(
  expr: Expression<Typed>,
  t: Type,
  userSpecified = false
): TConstraintExplicitInstance {
  return { type: "explicit-instance-constraint", expr, t, userSpecified };
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

interface InferResult<A> {
  result: A;
  constraints: TConstraint[];
  assumptions: TAssumption[];
}

export interface Typed {
  type: Monotype;
}

function inferMany(
  exprs: Expression[],
  monovars: string[]
): InferResult<Array<Expression<Typed>>> {
  const results = exprs.map(e => infer(e, monovars));
  return {
    result: results.map(r => r.result),
    constraints: flatMap(r => r.constraints, results),
    assumptions: flatMap(r => r.assumptions, results)
  };
}

// Generate new types for an expression an all its subexpressions,
// returning and a set of constraints and assumptions between them.
function infer(
  expr: Expression,
  // A set of type variables names whose type is monomorphic. That is
  // to say, all instances should have the same type. That is the set
  // of type variables introduced by lambda.
  monovars: string[]
): InferResult<Expression<Typed>> {
  switch (expr.type) {
    case "number":
      return {
        result: { ...expr, info: { type: tNumber } },
        constraints: [],
        assumptions: []
      };
    case "string":
      return {
        result: { ...expr, info: { type: tString } },
        constraints: [],
        assumptions: []
      };
    case "vector": {
      const inferredValues = inferMany(expr.values, monovars);
      const t = generateUniqueTVar();

      return {
        result: {
          ...expr,
          values: inferredValues.result,
          info: { type: tVector(t) }
        },
        assumptions: inferredValues.assumptions,
        constraints: [
          ...inferredValues.constraints,
          ...inferredValues.result.map(e => constEqual(e, t))
        ]
      };
    }

    case "record": {
      const inferred = expr.fields.map(({ label, labelLocation, value }) => ({
        label,
        labelLocation,
        ...infer(value, monovars)
      }));

      const tailInferred = expr.extends && infer(expr.extends, monovars);
      const tailRowType = generateUniqueTVar();

      return {
        result: {
          ...expr,
          fields: inferred.map(({ label, labelLocation, result: value }) => ({
            label,
            labelLocation,
            value
          })),
          extends: tailInferred && tailInferred.result,
          info: {
            type: tRecord(
              inferred.map(i => ({ label: i.label, type: i.result.info.type })),
              tailInferred ? tailRowType : emptyRow
            )
          }
        },
        assumptions: [
          ...flatMap(i => i.assumptions, inferred),
          ...(tailInferred ? tailInferred.assumptions : [])
        ],
        constraints: [
          ...flatMap(i => i.constraints, inferred),
          ...(tailInferred ? tailInferred.constraints : []),
          ...(tailInferred
            ? [
                constEqual(
                  tailInferred.result,
                  tRecord(
                    inferred.map(i => ({
                      label: i.label,
                      type: generateUniqueTVar()
                    })),
                    tailRowType
                  )
                )
              ]
            : [])
        ]
      };
    }
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
        result: typedVar,
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
        result: {
          ...expr,
          condition: condition.result,
          consequent: consequent.result,
          alternative: alternative.result,
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
          constEqual(condition.result, tBoolean),
          constEqual(consequent.result, t),
          constEqual(alternative.result, t)
        ]
      };
    }
    case "function": {
      const fnargs = expr.lambdaList.positionalArgs.map(a => a.variable);
      const argtypes = fnargs.map(_ => generateUniqueTVar());

      const { result: typedBody, constraints, assumptions } = inferMany(
        expr.body,
        [...monovars, ...argtypes.map(v => v.name)]
      );

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
        result: {
          ...expr,
          body: typedBody,
          info: {
            type: tFn(argtypes, last(typedBody)!.info.type)
          }
        },
        constraints: [...constraints, ...newConstraints],
        // assumptions have already been used, so they can be deleted.
        assumptions: assumptions.filter(v => !fnargs.includes(v.name))
      };
    }

    case "function-call": {
      const ifn = infer(expr.fn, monovars);
      const iargs = inferMany(expr.args, monovars);
      const tTo = generateUniqueTVar();
      const tfn: Monotype = tFn(iargs.result.map(a => a.info.type), tTo);
      return {
        result: {
          ...expr,
          fn: ifn.result,
          args: iargs.result,
          info: { type: tTo }
        },

        constraints: [
          constEqual(ifn.result, tfn) as TConstraint,
          ...ifn.constraints,
          ...iargs.constraints
        ],

        assumptions: [...ifn.assumptions, ...iargs.assumptions]
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
      const bodyInference = inferMany(expr.body, monovars);
      return {
        result: {
          ...expr,
          bindings: bindingsInfo.map(b => ({
            ...b.binding,
            value: b.inference.result
          })),
          body: bodyInference.result,
          info: {
            type: last(bodyInference.result)!.info.type
          }
        },
        constraints: [
          ...bodyInference.constraints,
          ...flatMap(i => i.inference.constraints, bindingsInfo),
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
                bInfo.inference.result.info.type
              );
            })
        ],
        assumptions: [
          ...bodyInference.assumptions.filter(v => !toBeBound(v.name)),
          ...flatMap(bi => bi.inference.assumptions, bindingsInfo)
        ]
      };
    }

    case "type-annotation": {
      const inferred = infer(expr.value, monovars);
      return {
        result: inferred.result,
        assumptions: inferred.assumptions,
        constraints: [
          ...inferred.constraints,
          constExplicitInstance(inferred.result, expr.valueType, true)
        ]
      };
    }
  }
}

function inferSyntax(syntax: Syntax): InferResult<Syntax<Typed>> {
  if (syntax.type === "definition") {
    const { result, assumptions, constraints } = infer(syntax.value, []);
    return {
      result: {
        ...syntax,
        value: result
      },
      assumptions,
      constraints
    };
  } else if (syntax.type === "export") {
    const { result, assumptions, constraints } = infer(syntax.value, []);
    return {
      result: {
        ...syntax,
        value: result as SVariableReference<Typed>
      },
      assumptions,
      constraints
    };
  } else {
    const { result, assumptions, constraints } = infer(syntax, []);
    return {
      result,
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

function lookupVariableType(
  varName: string,
  typeEnvironment: TypeEnvironment
): Type | null {
  const t = typeEnvironment[varName];
  if (t) {
    return t;
  } else if (isInlinePrimitive(varName)) {
    const prim = findInlinePrimitive(varName);
    return prim.type;
  } else {
    return null;
  }
}

// Generate constraints for those assumptions. Note that we generate
// explicit instance constraints, as it will allow us to have
// polymoprphic types in the environment.
function assumptionsToConstraints(
  assumptions: TAssumption[],
  typeEnvironment: TypeEnvironment
): TConstraint[] {
  return maybeMap(a => {
    const t = lookupVariableType(a.name, typeEnvironment);
    return t && constExplicitInstance(a, t);
  }, assumptions);
}

// Set of variables that are "active" in a set of constraints. This
// is, all variables except the ones that will be bound in a type
// scheme. This is used to decide which _instance constraint_ of the
// set can be solved first. See `solve`/`solvable` for further info.
function activevars(constraints: TConstraint[]): string[] {
  return flatMap(c => {
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
  }, constraints);
}

function substituteVar(tvarname: string, s: Substitution): string[] {
  const tv = tVar(tvarname);
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
        monovars: flatMap(name => substituteVar(name, s), c.monovars)
      };
    case "explicit-instance-constraint":
      return {
        type: "explicit-instance-constraint",
        expr: applySubstitutionToExpr(c.expr, s),
        t: applySubstitutionToPolytype(c.t, s),
        userSpecified: c.userSpecified
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
    case "vector":
      return {
        ...s,
        values: s.values.map(s1 => applySubstitutionToExpr(s1, env)),
        info: {
          ...s.info,
          type: applySubstitution(s.info.type, env)
        }
      };
    case "record":
      return {
        ...s,
        fields: s.fields.map(f => ({
          ...f,
          value: applySubstitutionToExpr(f.value, env)
        })),
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
        body: s.body.map(b => applySubstitutionToExpr(b, env)),
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
        body: s.body.map(e => applySubstitutionToExpr(e, env)),
        info: {
          ...s.info,
          type: applySubstitution(s.info.type, env)
        }
      };
    case "type-annotation":
      return {
        ...s,
        value: applySubstitutionToExpr(s.value, env),
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
  if (s.type === "definition") {
    return {
      ...s,
      value: applySubstitutionToExpr(s.value, env)
    };
  } else if (s.type === "export") {
    return {
      ...s,
      value: applySubstitutionToExpr(s.value, env) as SVariableReference<Typed>
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
            printHighlightedExpr(
              `Type mismatch

Expected ${printType(
                applySubstitution(result.t2, solution)
              )} instead of ${printType(applySubstitution(result.t1, solution))}

${printType(applySubstitution(constraint.expr.info.type, solution))}

vs.

${printType(applySubstitution(constraint.t, solution))}`,
              constraint.expr.location
            )
          );
        case "unify-missing-value-error":
          throw new Error(
            printHighlightedExpr(
              `Type mismatch

Missing value of type ${printType(applySubstitution(result.t, solution))}

${printType(applySubstitution(constraint.expr.info.type, solution))}

vs.

${printType(applySubstitution(constraint.t, solution))}

`,
              constraint.expr.location
            )
          );
        default:
          // Adding a default clause here makes Typescript detects
          // that this case won't fall through to the next one.
          throw new Error(`can't happen`);
      }
    }
    case "explicit-instance-constraint": {
      return solve(
        [
          constEqual(
            constraint.expr,
            instantiate(constraint.t, constraint.userSpecified)
          ),
          ...rest
        ],
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
  ...mapObject(primitives, prim => prim.type)
};

export function inferType(
  expr: Expression,
  typeEnvironment: TypeEnvironment = defaultTypeEnvironment
): Expression<Typed> {
  const { result: tmpExpr, constraints, assumptions } = infer(expr, []);

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
  const externals = assumptions.filter(
    v => lookupVariableType(v.name, externalEnv) !== null
  );
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
  const body = bodyInferences.map(i => i.result);

  const internalEnv: {
    [v: string]: Monotype;
  } = body.reduce((env, s) => {
    if (s.type === "definition") {
      return { ...env, [s.variable]: s.value.info.type };
    } else {
      return env;
    }
  }, {});

  const assumptions = groupAssumptions(
    flatMap(i => i.assumptions, bodyInferences),
    internalEnv,
    externalEnv
  );

  const constraints: TConstraint[] = [
    ...flatMap(i => i.constraints, bodyInferences),

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

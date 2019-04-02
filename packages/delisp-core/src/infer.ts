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

import { assertNever } from "./invariant";

import {
  Expression,
  isExpression,
  isTypeAlias,
  Module,
  SVariableReference,
  STypeAlias,
  Syntax,
  Typed
} from "./syntax";

import { transformRecurExpr } from "./syntax-utils";

import {
  applySubstitution,
  Substitution,
  transformRecurType
} from "./type-utils";
import { printType } from "./type-printer";

import { printHighlightedExpr } from "./error-report";

import { generateUniqueTVar } from "./type-generate";
import {
  generalize,
  instantiate,
  listTypeVariables,
  listTypeConstants
} from "./type-utils";

import {
  emptyRow,
  Type,
  tBoolean,
  tFn,
  tNumber,
  tRecord,
  tString,
  tVar,
  tVector,
  TypeSchema
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
  tag: "equal-constraint";
  expr: Expression<Typed>;
  t: Type;
}
function constEqual(expr: Expression<Typed>, t: Type): TConstraintEqual {
  return { tag: "equal-constraint", expr, t };
}

// A constriant stating that an expression's type is an instance of
// the (poly)type t.  This is generated when we already know somehow
// the generalized type of an expression. For example if the user has
// provided some type annotations.
interface TConstraintExplicitInstance {
  tag: "explicit-instance-constraint";
  expr: Expression<Typed>;
  t: TypeSchema;
}
function constExplicitInstance(
  expr: Expression<Typed>,
  t: TypeSchema
): TConstraintExplicitInstance {
  return { tag: "explicit-instance-constraint", expr, t };
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
  expr: Expression<Typed>;
  t: Type;
  monovars: string[];
}

function constImplicitInstance(
  expr: Expression<Typed>,
  monovars: string[],
  t: Type
): TConstraintImplicitInstance {
  return { tag: "implicit-instance-constraint", expr, monovars, t };
}

interface InferResult<A> {
  result: A;
  constraints: TConstraint[];
  assumptions: TAssumption[];
}

function inferMany(
  exprs: Expression[],
  monovars: string[],
  internalTypes: InternalTypeEnvironment
): InferResult<Array<Expression<Typed>>> {
  const results = exprs.map(e => infer(e, monovars, internalTypes));
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
  monovars: string[],
  // Known type aliases that must be expanded
  internalTypes: InternalTypeEnvironment
): InferResult<Expression<Typed>> {
  switch (expr.node.tag) {
    case "number":
      return {
        result: {
          ...expr,
          node: expr.node,
          info: { type: tNumber }
        },
        constraints: [],
        assumptions: []
      };
    case "string":
      return {
        result: {
          ...expr,
          node: expr.node,
          info: { type: tString }
        },
        constraints: [],
        assumptions: []
      };
    case "vector": {
      const inferredValues = inferMany(
        expr.node.values,
        monovars,
        internalTypes
      );
      const t = generateUniqueTVar();

      return {
        result: {
          ...expr,
          node: {
            ...expr.node,
            values: inferredValues.result
          },
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
      const inferred = expr.node.fields.map(({ label, value }) => ({
        label,
        ...infer(value, monovars, internalTypes)
      }));

      const tailInferred =
        expr.node.extends && infer(expr.node.extends, monovars, internalTypes);
      const tailRowType = generateUniqueTVar();

      return {
        result: {
          ...expr,
          node: {
            ...expr.node,
            fields: inferred.map(({ label, result: value }) => ({
              label,
              value
            })),
            extends: tailInferred && tailInferred.result
          },
          info: {
            type: tRecord(
              inferred.map(i => ({
                label: i.label.name,
                type: i.result.info.type
              })),
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
                      label: i.label.name,
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
        node: {
          ...expr.node
        },
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
      const condition = infer(expr.node.condition, monovars, internalTypes);
      const consequent = infer(expr.node.consequent, monovars, internalTypes);
      const alternative = infer(expr.node.alternative, monovars, internalTypes);
      const t = generateUniqueTVar();

      return {
        result: {
          ...expr,
          node: {
            ...expr.node,
            condition: condition.result,
            consequent: consequent.result,
            alternative: alternative.result
          },
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
      const fnargs = expr.node.lambdaList.positionalArgs.map(a => a.name);
      const argtypes = fnargs.map(_ => generateUniqueTVar());

      const { result: typedBody, constraints, assumptions } = inferMany(
        expr.node.body,
        [...monovars, ...argtypes.map(v => v.node.name)],
        internalTypes
      );

      // Generate a constraint for each assumption pending for each
      // argument, stating that they are equal to the argument types
      // the new function type we have created.
      const newConstraints: TConstraint[] = [
        ...assumptions
          .filter(v => fnargs.includes(v.node.name))
          .map(v => {
            const varIndex = fnargs.indexOf(v.node.name);
            return constEqual(v, argtypes[varIndex]);
          })
      ];
      return {
        result: {
          ...expr,
          node: {
            ...expr.node,
            body: typedBody
          },
          info: {
            type: tFn(argtypes, last(typedBody)!.info.type)
          }
        },
        constraints: [...constraints, ...newConstraints],
        // assumptions have already been used, so they can be deleted.
        assumptions: assumptions.filter(v => !fnargs.includes(v.node.name))
      };
    }

    case "function-call": {
      const ifn = infer(expr.node.fn, monovars, internalTypes);
      const iargs = inferMany(expr.node.args, monovars, internalTypes);
      const tTo = generateUniqueTVar();
      const tfn: Type = tFn(iargs.result.map(a => a.info.type), tTo);
      return {
        result: {
          ...expr,
          node: {
            ...expr.node,
            fn: ifn.result,
            args: iargs.result
          },
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
      const vars = new Set(expr.node.bindings.map(b => b.variable.name));
      const toBeBound = (vname: string) => vars.has(vname);

      const bindingsInfo = expr.node.bindings.map(b => {
        return {
          binding: b,
          inference: infer(b.value, monovars, internalTypes)
        };
      });
      const bodyInference = inferMany(expr.node.body, monovars, internalTypes);
      return {
        result: {
          ...expr,
          node: {
            ...expr.node,
            bindings: bindingsInfo.map(b => ({
              ...b.binding,
              value: b.inference.result
            })),
            body: bodyInference.result
          },
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
            .filter(v => toBeBound(v.node.name))
            .map(v => {
              // We just filter the assumptions to the variables
              // that are bound, so we know it must is defined.
              const bInfo = bindingsInfo.find(
                bi => bi.binding.variable.name === v.node.name
              )!;
              return constImplicitInstance(
                v,
                monovars,
                bInfo.inference.result.info.type
              );
            })
        ],
        assumptions: [
          ...bodyInference.assumptions.filter(v => !toBeBound(v.node.name)),
          ...flatMap(bi => bi.inference.assumptions, bindingsInfo)
        ]
      };
    }

    case "type-annotation": {
      const inferred = infer(expr.node.value, monovars, internalTypes);
      const t = expandTypeAliases(
        expr.node.typeWithWildcards.instantiate(),
        internalTypes
      );

      return {
        result: {
          ...expr,
          node: {
            ...expr.node,
            ...inferred.result.node
          },
          info: {
            type: t
          }
        },
        assumptions: inferred.assumptions,
        constraints: [...inferred.constraints, constEqual(inferred.result, t)]
      };
    }
  }
}

function inferSyntax(
  syntax: Syntax,
  internalTypes: InternalTypeEnvironment
): InferResult<Syntax<Typed>> {
  if (isExpression(syntax)) {
    const { result, assumptions, constraints } = infer(
      { ...syntax, node: { ...syntax.node } },
      [],
      internalTypes
    );
    return {
      result,
      assumptions,
      constraints
    };
  } else if (syntax.node.tag === "definition") {
    const { result, assumptions, constraints } = infer(
      syntax.node.value,
      [],
      internalTypes
    );
    return {
      result: {
        ...syntax,
        node: {
          ...syntax.node,
          value: result
        }
      },
      assumptions,
      constraints
    };
  } else if (syntax.node.tag === "export") {
    return {
      result: {
        ...syntax,
        node: syntax.node
      },
      assumptions: [],
      constraints: []
    };
  } else if (syntax.node.tag === "type-alias") {
    return {
      result: {
        ...syntax,
        node: syntax.node
      },
      assumptions: [],
      constraints: []
    };
  } else {
    return assertNever(syntax.node);
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

export interface ExternalEnvironment {
  variables: {
    [v: string]: TypeSchema;
  };
  types: {
    [t: string]: Type;
  };
}

export interface InternalTypeEnvironment {
  [t: string]: Type;
}

export interface InternalEnvironment {
  variables: {
    [v: string]: Type;
  };
  types: InternalTypeEnvironment;
}

function lookupVariableType(
  varName: string,
  env: ExternalEnvironment
): TypeSchema | null {
  const t = env.variables[varName];
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
  env: ExternalEnvironment
): TConstraint[] {
  return maybeMap(a => {
    const t = lookupVariableType(a.node.name, env);
    return t && constExplicitInstance(a, t);
  }, assumptions);
}

// Set of variables that are "active" in a set of constraints. This
// is, all variables except the ones that will be bound in a type
// scheme. This is used to decide which _instance constraint_ of the
// set can be solved first. See `solve`/`solvable` for further info.
function activevars(constraints: TConstraint[]): string[] {
  return flatMap(c => {
    switch (c.tag) {
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
function applySubstitutionToPolytype(
  t: TypeSchema,
  s: Substitution
): TypeSchema {
  return {
    tag: "type",
    tvars: t.tvars,
    mono: applySubstitution(t.mono, removeSubstitution(s, t.tvars))
  };
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
        t: applySubstitution(c.t, s)
      };
    case "implicit-instance-constraint":
      return {
        tag: "implicit-instance-constraint",
        expr: applySubstitutionToExpr(c.expr, s),
        t: applySubstitution(c.t, s),
        monovars: flatMap(name => substituteVar(name, s), c.monovars)
      };
    case "explicit-instance-constraint":
      return {
        tag: "explicit-instance-constraint",
        expr: applySubstitutionToExpr(c.expr, s),
        t: applySubstitutionToPolytype(c.t, s)
      };
  }
}

function applySubstitutionToExpr(
  s: Expression<Typed>,
  env: Substitution
): Expression<Typed> {
  return transformRecurExpr(s, expr => ({
    ...expr,
    info: {
      ...expr.info,
      type: applySubstitution(expr.info.type, env)
    }
  }));
}

function applySubstitutionToSyntax(
  s: Syntax<Typed>,
  env: Substitution
): Syntax<Typed> {
  if (isExpression(s)) {
    return applySubstitutionToExpr(s, env);
  } else if (s.node.tag === "definition") {
    return {
      ...s,
      node: {
        ...s.node,
        value: applySubstitutionToExpr(s.node.value, env)
      }
    };
  } else if (s.node.tag === "export") {
    return s;
  } else if (s.node.tag === "type-alias") {
    return s;
  } else {
    return assertNever(s.node);
  }
}

// Solve the set of constraints generated by `infer`, returning a substitution that
// can be applied to the temporary types to get the principal type of the expression.
function solve(
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

  switch (constraint.tag) {
    case "equal-constraint": {
      const result = unify(constraint.expr.info.type, constraint.t, solution);

      switch (result.tag) {
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
          return assertNever(result);
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

const defaultEnvironment: ExternalEnvironment = {
  variables: mapObject(primitives, prim => prim.type),
  types: {}
};

export function inferType(
  expr: Expression,
  env: ExternalEnvironment = defaultEnvironment,
  internalTypes: InternalTypeEnvironment
): Expression<Typed> {
  const { result: tmpExpr, constraints, assumptions } = infer(
    expr,
    [],
    internalTypes
  );

  const s = solve(
    [...constraints, ...assumptionsToConstraints(assumptions, env)],
    {}
  );

  return applySubstitutionToExpr(tmpExpr, s);
}

// Group the gathered assumptions and classify them into:
//
// - internals: The variable referes to a variable defined in this module.
// - externals: The variable referes to an imported module.
// - unknown: The variable does not refer to anything known.
//
function groupAssumptions(
  assumptions: TAssumption[],
  internalEnv: InternalEnvironment,
  externalEnv: ExternalEnvironment
): {
  internals: TAssumption[];
  externals: TAssumption[];
  unknowns: TAssumption[];
} {
  const internals = assumptions.filter(
    v => v.node.name in internalEnv.variables
  );
  const externals = assumptions.filter(
    v => lookupVariableType(v.node.name, externalEnv) !== null
  );
  return {
    internals,
    externals,
    unknowns: difference(assumptions, [...internals, ...externals])
  };
}

/** Check that there is no cycles in env, throwing an error otherwise. */
function checkCircularTypes(allTypeAliases: STypeAlias[]) {
  // The type aliases reference each other and then form a directed
  // graph. Here we do a simple depth-first search, keeping track of
  // the path to report if we find any cycles.
  function visit(typeAlias: STypeAlias, path: STypeAlias[]) {
    const index = path.indexOf(typeAlias);
    if (index < 0) {
      listTypeConstants(typeAlias.node.definition)
        .map(ud => {
          return allTypeAliases.find(x => x.node.alias.name === ud.node.name);
        })
        .forEach(dep => {
          if (!dep) {
            return;
          }
          visit(dep, [...path, typeAlias]);
        });
    } else {
      // the current node is reachable from itself. We can report a
      // cycle here.
      const cycle = [...path.slice(index), typeAlias];
      if (cycle.length === 1) {
        throw new Error(
          printHighlightedExpr(
            `Recursive type aliases are not allowed.`,
            typeAlias.location
          )
        );
      } else {
        throw new Error(
          printHighlightedExpr(
            `Cicular dependency in type aliases found
  ${cycle.map(s => s.node.alias.name).join(" -> ")}
`,
            typeAlias.location
          )
        );
      }
    }
  }

  allTypeAliases.forEach(tAlias => visit(tAlias, []));
}

/** Expand known type aliases from a monotype. */
function expandTypeAliases(type: Type, env: InternalTypeEnvironment): Type {
  return transformRecurType(type, t => {
    if (t.node.tag == "constant") {
      const def = env[t.node.name];
      return def ? expandTypeAliases(def, env) : t;
    } else return t;
  });
}

/** Run the type inference on a module.
 *
 * @description Takes a Module and the external environment, will run
 * inference returning the same module with the types annotated in the
 * AST. Additionally, a set of unknown references is returned so those
 * can be reported.
 */
export function inferModule(
  m: Module,
  externalEnv: ExternalEnvironment = defaultEnvironment
): {
  typedModule: Module<Typed>;
  unknowns: TAssumption[];
} {
  checkCircularTypes(m.body.filter(isTypeAlias));
  const internalTypes: InternalTypeEnvironment = m.body.reduce((env, s) => {
    if (s.node.tag === "type-alias") {
      return { ...env, [s.node.alias.name]: s.node.definition };
    } else {
      return env;
    }
  }, {});

  const bodyInferences = m.body.map(form => inferSyntax(form, internalTypes));
  const body = bodyInferences.map(i => i.result);

  const internalEnv: InternalEnvironment = {
    variables: body.reduce((env, s) => {
      if (s.node.tag === "definition") {
        return { ...env, [s.node.variable.name]: s.node.value.info.type };
      } else {
        return env;
      }
    }, {}),

    types: internalTypes
  };

  const assumptions = groupAssumptions(
    flatMap(i => i.assumptions, bodyInferences),
    internalEnv,
    externalEnv
  );

  const constraints: TConstraint[] = [
    ...flatMap(i => i.constraints, bodyInferences),

    ...assumptionsToConstraints(assumptions.externals, externalEnv),

    ...assumptions.internals.map(v =>
      constImplicitInstance(v, [], internalEnv.variables[v.node.name])
    )
  ];

  const solution = solve(constraints, {});

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

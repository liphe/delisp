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
  findInlinePrimitive,
  isInlinePrimitive
} from "./compiler/inline-primitives";
import { printHighlightedExpr } from "./error-report";
import { ExternalEnvironment } from "./infer-environment";
import {
  constEffect,
  constEqual,
  constExplicitInstance,
  constImplicitInstance,
  solve,
  TConstraint,
  TAssumption
} from "./infer-solver";
import {
  applyTypeSubstitutionToVariable,
  applySubstitutionToExpr,
  applySubstitutionToSyntax
} from "./infer-subst";
import { assertNever, InvariantViolation } from "./invariant";
import { moduleExportedDefinitions } from "./module";
import primitives from "./primitives";
import * as S from "./syntax";
import { Typed } from "./syntax-typed";
import {
  lambdaListAllArguments,
  funcallAllArguments
} from "./syntax-functions";
import { generateUniqueTVar } from "./type-generate";
import { type } from "./type-tag";
import {
  generalize,
  listTypeConstants,
  applySubstitution,
  transformRecurType
} from "./type-utils";
import * as T from "./types";
import { Type } from "./types";
import { difference, flatMap, fromEntries, mapObject, maybeMap } from "./utils";

// The type inference process is split in two stages. Firstly, `infer`
// will run through the syntax it will generate dummy type variables,
// together with a set of constraints and assumptions.
//

interface InferResult<A> {
  result: A;
  constraints: TConstraint[];
  assumptions: TAssumption[];
}

function inferMany(
  exprs: S.Expression[],
  monovars: T.Var[],
  internalTypes: InternalTypeEnvironment,
  options = {
    multipleValuedLastForm: false
  }
): InferResult<Array<S.Expression<Typed>>> {
  const results = exprs.map((e, i) =>
    infer(
      e,
      monovars,
      internalTypes,
      options.multipleValuedLastForm && i === exprs.length - 1
    )
  );
  return {
    result: results.map(r => r.result),
    constraints: flatMap(r => r.constraints, results),
    assumptions: flatMap(r => r.assumptions, results)
  };
}

function inferBody(
  exprs: S.Expression[],
  monovars: T.Var[],
  internalTypes: InternalTypeEnvironment,
  returnType: Type,
  effectType: Type,
  multipleValues: boolean
) {
  if (exprs.length === 0) {
    throw new Error(`Empty body is not allowed!`);
  }

  const inferred = inferMany(exprs, monovars, internalTypes, {
    multipleValuedLastForm: multipleValues
  });

  const returningForm = inferred.result[inferred.result.length - 1];

  return {
    result: inferred.result,
    constraints: [
      ...inferred.constraints,
      constEqual(
        returningForm,
        returningForm.info.resultingType,
        "resulting-type",
        returnType
      ),
      ...inferred.result.map(form => constEffect(form, effectType))
    ],
    assumptions: inferred.assumptions
  };
}

function constraintMonomorphicAssumption(
  assumption: TAssumption,
  type: Type
): TConstraint[] {
  const { variable } = assumption;
  return [
    constEqual(variable, variable.info.expressionType, "expression-type", type),
    constEqual(variable, assumption.primaryResultingType, "primary-type", type)
  ];
}

// Generate new types for an expression an all its subexpressions,
// returning and a set of constraints and assumptions between them.
function infer(
  expr: S.Expression,
  // A set of type variables names whose type is monomorphic. That is
  // to say, all instances should have the same type. That is the set
  // of type variables introduced by lambda.
  monovars: T.Var[],
  // Known type aliases that must be expanded
  internalTypes: InternalTypeEnvironment,

  // True if the caller wants the _resulting type_ to be a
  // multi-valued type. For many forms, being multipleValues or not
  // depends on if the parent itself is multipleValued. If that's the
  // case, just pass the value down to the subexpressions.
  multipleValues: boolean
): InferResult<S.Expression<Typed>> {
  // Create metadata necessary to represent an expression returning a
  // single value. If the expression is in a tail position, the
  // resulting type will be wrapped in a values type.
  function singleType(effect: Type, type: Type): Typed {
    return new Typed({
      expressionType: type,
      resultingType: multipleValues ? T.values([type]) : undefined,
      effect
    });
  }

  // Create metadata necessary to represent the type of an expression
  // as equal to the type of a subexpression.
  function delegatedType(effect: Type, type: Type): Typed {
    return new Typed({
      expressionType: type,
      effect
    });
  }

  switch (expr.node.tag) {
    case "unknown":
      return {
        result: {
          ...expr,
          node: expr.node,
          info: singleType(generateUniqueTVar(), generateUniqueTVar())
        },
        constraints: [],
        assumptions: []
      };

    case "number":
      return {
        result: {
          ...expr,
          node: expr.node,
          info: singleType(generateUniqueTVar(), T.number)
        },
        constraints: [],
        assumptions: []
      };
    case "string":
      return {
        result: {
          ...expr,
          node: expr.node,
          info: singleType(generateUniqueTVar(), T.string)
        },
        constraints: [],
        assumptions: []
      };
    case "boolean":
      return {
        result: {
          ...expr,
          node: expr.node,
          info: singleType(generateUniqueTVar(), T.boolean)
        },
        constraints: [],
        assumptions: []
      };
    case "none":
      return {
        result: {
          ...expr,
          node: expr.node,
          info: singleType(generateUniqueTVar(), T.none)
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
      const effect = generateUniqueTVar();
      return {
        result: {
          ...expr,
          node: {
            ...expr.node,
            values: inferredValues.result
          },
          info: singleType(effect, T.vector(t))
        },
        assumptions: inferredValues.assumptions,
        constraints: [
          ...inferredValues.constraints,
          ...inferredValues.result.map(e =>
            constEqual(e, e.info.resultingType, "resulting-type", t)
          ),
          ...inferredValues.result.map(e => constEffect(e, effect))
        ]
      };
    }

    case "record": {
      const inferred = expr.node.fields.map(({ label, value }) => ({
        label,
        ...infer(value, monovars, internalTypes, false)
      }));

      const tailInferred =
        expr.node.source &&
        infer(expr.node.source.expression, monovars, internalTypes, false);
      const tailRowType = generateUniqueTVar();

      const effect = generateUniqueTVar();

      return {
        result: {
          ...expr,
          node: {
            ...expr.node,
            fields: inferred.map(({ label, result: value }) => ({
              label,
              value
            })),
            source: tailInferred &&
              expr.node.source && {
                extending: expr.node.source.extending,
                expression: tailInferred.result
              }
          },
          info: singleType(
            effect,
            T.record(
              inferred.map(i => ({
                label: i.label.name,
                type: i.result.info.resultingType
              })),
              tailInferred ? tailRowType : T.emptyRow
            )
          )
        },
        assumptions: [
          ...flatMap(i => i.assumptions, inferred),
          ...(tailInferred ? tailInferred.assumptions : [])
        ],
        constraints: [
          ...flatMap(i => i.constraints, inferred),
          ...(tailInferred ? tailInferred.constraints : []),
          ...(tailInferred && expr.node.source
            ? [
                constEqual(
                  tailInferred.result,
                  tailInferred.result.info.resultingType,
                  "resulting-type",
                  T.record(
                    expr.node.source.extending
                      ? []
                      : inferred.map(i => ({
                          label: i.label.name,
                          type: generateUniqueTVar()
                        })),
                    tailRowType
                  )
                )
              ]
            : []),

          ...inferred.map(i => constEffect(i.result, effect)),
          ...(tailInferred ? [constEffect(tailInferred.result, effect)] : [])
        ]
      };
    }

    case "record-get": {
      const label = expr.node.field.name;
      const labelType = generateUniqueTVar();
      const effect = generateUniqueTVar();

      const value = infer(expr.node.value, monovars, internalTypes, false);

      const recordType = T.record(
        [{ label, type: labelType }],
        generateUniqueTVar()
      );

      return {
        result: {
          ...expr,
          node: {
            ...expr.node,
            value: value.result
          },
          info: singleType(effect, labelType)
        },
        constraints: [
          ...value.constraints,
          constEqual(
            value.result,
            value.result.info.resultingType,
            "resulting-type",
            recordType
          ),
          constEffect(value.result, effect)
        ],
        assumptions: value.assumptions
      };
    }

    case "variable-reference": {
      const expressionType = generateUniqueTVar();
      const primaryResultingType = generateUniqueTVar();
      const effect = generateUniqueTVar();
      const typedVar = {
        ...expr,
        node: {
          ...expr.node
        },
        info: new Typed({
          expressionType,
          resultingType: multipleValues
            ? T.values([primaryResultingType])
            : primaryResultingType,
          effect
        })
      };
      return {
        result: typedVar,
        constraints: [],
        assumptions: [
          {
            variable: typedVar,
            primaryResultingType
          }
        ]
      };
    }
    case "conditional": {
      const condition = infer(
        expr.node.condition,
        monovars,
        internalTypes,
        false
      );
      const consequent = infer(
        expr.node.consequent,
        monovars,
        internalTypes,
        multipleValues
      );
      const alternative = infer(
        expr.node.alternative,
        monovars,
        internalTypes,
        multipleValues
      );

      const t = generateUniqueTVar();
      const effect = generateUniqueTVar();

      return {
        result: {
          ...expr,
          node: {
            ...expr.node,
            condition: condition.result,
            consequent: consequent.result,
            alternative: alternative.result
          },
          info: delegatedType(effect, t)
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
          constEqual(
            condition.result,
            condition.result.info.resultingType,
            "resulting-type",
            T.boolean
          ),
          constEqual(
            consequent.result,
            consequent.result.info.resultingType,
            "resulting-type",
            t
          ),
          constEqual(
            alternative.result,
            alternative.result.info.resultingType,
            "resulting-type",
            t
          ),

          constEffect(condition.result, effect),
          constEffect(consequent.result, effect),
          constEffect(alternative.result, effect)
        ]
      };
    }
    case "function": {
      const fnargs = lambdaListAllArguments(expr.node.lambdaList).map(
        a => a.name
      );
      const argtypes = fnargs.map(_ => generateUniqueTVar());

      const bodyEffect = generateUniqueTVar();
      const valuesType = generateUniqueTVar();
      const fnType = T.multiValuedFunction(argtypes, bodyEffect, valuesType);

      const { result: typedBody, constraints, assumptions } = inferBody(
        expr.node.body,
        [...monovars, ...argtypes],
        internalTypes,
        valuesType,
        bodyEffect,
        true
      );

      // Generate a constraint for each assumption pending for each
      // argument, stating that they are equal to the argument types
      // the new function type we have created.
      const newConstraints: TConstraint[] = [
        ...assumptions
          .filter(a => fnargs.includes(a.variable.node.name))
          .flatMap(a => {
            const varIndex = fnargs.indexOf(a.variable.node.name);
            return constraintMonomorphicAssumption(a, argtypes[varIndex]);
          })
      ];

      return {
        result: {
          ...expr,
          node: {
            ...expr.node,
            body: typedBody
          },
          info: singleType(generateUniqueTVar(), fnType)
        },
        constraints: [...constraints, ...newConstraints],
        // assumptions have already been used, so they can be deleted.
        assumptions: assumptions.filter(
          a => !fnargs.includes(a.variable.node.name)
        )
      };
    }

    case "function-call": {
      const ifn = infer(expr.node.fn, monovars, internalTypes, false);
      const iargs = inferMany(
        funcallAllArguments({ ...expr, node: { ...expr.node } }),
        monovars,
        internalTypes
      );

      const primaryType = generateUniqueTVar();
      const valuesType = type`(values ${primaryType} <| _)`;

      const effect = generateUniqueTVar();
      const tfn: Type = T.multiValuedFunction(
        iargs.result.map(a => a.info.resultingType),
        effect,
        valuesType
      );

      return {
        result: {
          ...expr,
          node: {
            ...expr.node,
            fn: ifn.result,
            userArguments: iargs.result.slice(1) // don't include the context argument
          },
          info: multipleValues
            ? delegatedType(effect, valuesType)
            : singleType(effect, primaryType)
        },

        constraints: [
          constEqual(
            ifn.result,
            ifn.result.info.resultingType,
            "resulting-type",
            tfn
          ),
          ...ifn.constraints,
          ...iargs.constraints,

          constEffect(ifn.result, effect),
          ...iargs.result.map(a => constEffect(a, effect))
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
      // (let {id (lambda (x) x)}
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
          inference: infer(b.value, monovars, internalTypes, false)
        };
      });

      const t = generateUniqueTVar();
      const effect = generateUniqueTVar();

      const bodyInference = inferBody(
        expr.node.body,
        monovars,
        internalTypes,
        t,
        effect,
        multipleValues
      );

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
          info: delegatedType(effect, t)
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
            .filter(a => toBeBound(a.variable.node.name))
            .map(a => {
              // We just filter the assumptions to the variables
              // that are bound, so we know it must is defined.
              const bInfo = bindingsInfo.find(
                bi => bi.binding.variable.name === a.variable.node.name
              )!;
              return constImplicitInstance(
                a,
                monovars,
                bInfo.inference.result.info.resultingType
              );
            }),

          // We require let-binding values to be free of effects
          ...bindingsInfo.map(b =>
            constEffect(b.inference.result, T.effect([]))
          )
        ],
        assumptions: [
          ...bodyInference.assumptions.filter(
            a => !toBeBound(a.variable.node.name)
          ),
          ...flatMap(bi => bi.inference.assumptions, bindingsInfo)
        ]
      };
    }

    case "type-annotation": {
      const inferred = infer(
        expr.node.value,
        monovars,
        internalTypes,
        multipleValues
      );

      const effect = generateUniqueTVar();

      const t = expandTypeAliases(
        // Note that the type variables specified by the user are
        // user-specified (or rigid) variables. It is important that
        // we instantiate this type in order to create fresh
        // user-specified variables to avoid possible name clashes as
        // type variables are compared by name.
        expr.node.typeWithWildcards.instantiate(),
        internalTypes
      );

      return {
        result: {
          ...expr,
          node: {
            ...expr.node,
            value: inferred.result
          },
          info: delegatedType(effect, t)
        },
        assumptions: inferred.assumptions,
        constraints: [
          ...inferred.constraints,
          constEqual(
            inferred.result,
            inferred.result.info.expressionType,
            "expression-type",
            t
          ),
          constEffect(inferred.result, effect)
        ]
      };
    }

    case "do-block": {
      const body = inferMany(expr.node.body, monovars, internalTypes);
      const returning = infer(
        expr.node.returning,
        monovars,
        internalTypes,
        multipleValues
      );

      const effect = generateUniqueTVar();

      return {
        result: {
          ...expr,
          node: {
            ...expr.node,
            body: body.result,
            returning: returning.result
          },
          info: delegatedType(effect, returning.result.info.resultingType)
        },

        constraints: [
          ...body.constraints,
          ...returning.constraints,

          ...body.result.map(form => constEffect(form, effect)),
          constEffect(returning.result, effect)
        ],
        assumptions: [...body.assumptions, ...returning.assumptions]
      };
    }

    case "match": {
      const value = infer(expr.node.value, monovars, internalTypes, false);

      const t = generateUniqueTVar();
      const effect = generateUniqueTVar();

      const cases = expr.node.cases.map(c => {
        const vartype = generateUniqueTVar();
        const { result, constraints, assumptions } = inferBody(
          c.body,
          [...monovars, vartype],
          internalTypes,
          t,
          effect,
          multipleValues
        );
        return {
          ...c,
          vartype,
          infer: {
            result,
            constraints: [
              ...constraints,
              ...assumptions
                .filter(a => a.variable.node.name === c.variable.name)
                .flatMap(a => constraintMonomorphicAssumption(a, vartype))
            ],
            assumptions: assumptions.filter(
              a => a.variable.node.name !== c.variable.name
            )
          }
        };
      });

      const defaultCase =
        expr.node.defaultCase &&
        inferBody(
          expr.node.defaultCase,
          monovars,
          internalTypes,
          t,
          effect,
          multipleValues
        );

      const variantTypes = cases.map(c => ({
        label: c.label,
        type: c.vartype
      }));

      return {
        result: {
          ...expr,
          node: {
            ...expr.node,
            value: value.result,
            cases: cases.map(c => ({
              label: c.label,
              variable: c.variable,
              body: c.infer.result
            })),
            defaultCase: defaultCase && defaultCase.result
          },
          info: delegatedType(effect, t)
        },

        constraints: [
          ...value.constraints,
          ...flatMap(c => c.infer.constraints, cases),
          ...(defaultCase ? defaultCase.constraints : []),
          // Value must produce a value of type with all the variants
          // that `match` is handling.
          constEqual(
            value.result,
            value.result.info.resultingType,
            "resulting-type",
            T.cases(
              variantTypes,
              defaultCase ? generateUniqueTVar() : undefined
            )
          ),
          constEffect(value.result, effect)
        ],

        assumptions: [
          ...value.assumptions,
          ...flatMap(c => c.infer.assumptions, cases),
          ...(defaultCase ? defaultCase.assumptions : [])
        ]
      };
    }

    case "case": {
      const inferredValue =
        expr.node.value &&
        infer(expr.node.value, monovars, internalTypes, false);

      const labelType = expr.node.value ? generateUniqueTVar() : T.void;
      const t = T.cases(
        [{ label: expr.node.label, type: labelType }],
        generateUniqueTVar()
      );
      const effect = generateUniqueTVar();

      return {
        result: {
          ...expr,
          node: {
            ...expr.node,
            label: expr.node.label,
            value: inferredValue && inferredValue.result
          },
          info: singleType(effect, t)
        },

        constraints: inferredValue
          ? [
              ...inferredValue.constraints,
              constEffect(inferredValue.result, effect),
              constEqual(
                inferredValue.result,
                inferredValue.result.info.resultingType,
                "resulting-type",
                labelType
              )
            ]
          : [],

        assumptions: inferredValue ? inferredValue.assumptions : []
      };
    }

    case "values": {
      const inference = inferMany(expr.node.values, monovars, internalTypes);

      const tPrimaryType = inference.result[0].info.resultingType;
      const tValuesType = T.values(
        inference.result.map(r => r.info.resultingType)
      );

      const effect = generateUniqueTVar();

      return {
        result: {
          ...expr,
          node: {
            ...expr.node,
            values: inference.result
          },
          info: multipleValues
            ? delegatedType(effect, tValuesType)
            : singleType(effect, tPrimaryType)
        },

        constraints: [
          ...inference.constraints,
          ...inference.result.map(r => constEffect(r, effect))
        ],

        assumptions: inference.assumptions
      };
    }

    case "multiple-value-bind": {
      const t = generateUniqueTVar();
      const effect = generateUniqueTVar();

      const variableNames = expr.node.variables.map(v => v.name);
      const variableTypes = variableNames.map(_ => generateUniqueTVar());

      const form = infer(expr.node.form, monovars, internalTypes, true);
      const body = inferBody(
        expr.node.body,
        [...monovars, ...variableTypes],
        internalTypes,
        t,
        effect,
        multipleValues
      );

      return {
        result: {
          ...expr,
          node: {
            ...expr.node,
            form: form.result,
            body: body.result
          },
          info: delegatedType(effect, t)
        },

        constraints: [
          ...form.constraints,
          constEqual(
            form.result,
            form.result.info.resultingType,
            "resulting-type",
            T.values(variableTypes)
          ),
          constEffect(form.result, effect),

          ...body.constraints,
          ...body.assumptions
            .filter(a => variableNames.includes(a.variable.node.name))
            .flatMap(a => {
              const name = a.variable.node.name;
              const idx = variableNames.indexOf(name);
              if (idx < 0) {
                throw new InvariantViolation(
                  `Could not find variable in the list of assumptions.`
                );
              }
              return constraintMonomorphicAssumption(a, variableTypes[idx]);
            })
        ],

        assumptions: [
          ...form.assumptions,
          ...body.assumptions.filter(
            a => !variableNames.includes(a.variable.node.name)
          )
        ]
      };
    }
  }
}

function inferSyntax(
  syntax: S.Syntax,
  internalTypes: InternalTypeEnvironment
): InferResult<S.Syntax<Typed>> {
  if (S.isExpression(syntax)) {
    const { result, assumptions, constraints } = infer(
      { ...syntax, node: { ...syntax.node } },
      [],
      internalTypes,
      false
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
      internalTypes,
      false
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
  } else if (syntax.node.tag === "import") {
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
): T.TypeSchema | null {
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
    const t = lookupVariableType(a.variable.node.name, env);
    return t && constExplicitInstance(a, t);
  }, assumptions);
}

export const defaultEnvironment: ExternalEnvironment = {
  variables: mapObject(primitives, prim => prim.type),
  types: {}
};

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
    a => a.variable.node.name in internalEnv.variables
  );
  const externals = assumptions.filter(
    a => lookupVariableType(a.variable.node.name, externalEnv) !== null
  );
  return {
    internals,
    externals,
    unknowns: difference(assumptions, [...internals, ...externals])
  };
}

/** Check that there is no cycles in env, throwing an error otherwise. */
function checkCircularTypes(allTypeAliases: S.STypeAlias[]) {
  // The type aliases reference each other and then form a directed
  // graph. Here we do a simple depth-first search, keeping track of
  // the path to report if we find any cycles.
  function visit(typeAlias: S.STypeAlias, path: S.STypeAlias[]) {
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

/** Return an environment with the types defined in this module.  */
function moduleInternalTypes(m: S.Module): InternalTypeEnvironment {
  checkCircularTypes(m.body.filter(S.isTypeAlias));
  return m.body.reduce((env, s) => {
    if (s.node.tag === "type-alias") {
      return { ...env, [s.node.alias.name]: s.node.definition };
    } else {
      return env;
    }
  }, {});
}

function getModuleInternalEnvironment(
  m: S.Module<Typed>,
  internalTypes: InternalTypeEnvironment
): InternalEnvironment {
  return {
    variables: m.body.reduce((env, s) => {
      if (s.node.tag === "definition") {
        return {
          ...env,
          [s.node.variable.name]: s.node.value.info.resultingType
        };
      } else {
        return env;
      }
    }, {}),

    types: internalTypes
  };
}

/** Run the type inference on a module.
 *
 * @description Takes a Module and the external environment, will run
 * inference returning the same module with the types annotated in the
 * AST. Additionally, a set of unknown references is returned so those
 * can be reported.
 */
export function inferModule(
  m: S.Module,
  externalEnv: ExternalEnvironment = defaultEnvironment
): {
  typedModule: S.Module<Typed>;
  unknowns: TAssumption[];
} {
  const internalTypes = moduleInternalTypes(m);
  const bodyInferences = m.body.map(form => inferSyntax(form, internalTypes));
  const body = bodyInferences.map(i => i.result);
  const internalEnv = getModuleInternalEnvironment(
    { tag: "module", body },
    internalTypes
  );

  const assumptions = groupAssumptions(
    flatMap(i => i.assumptions, bodyInferences),
    internalEnv,
    externalEnv
  );

  const constraints: TConstraint[] = [
    ...flatMap(i => i.constraints, bodyInferences),

    ...assumptionsToConstraints(assumptions.externals, externalEnv),

    ...assumptions.internals.map(a =>
      constImplicitInstance(a, [], internalEnv.variables[a.variable.node.name])
    )
  ];

  const solution = solve(constraints, {});

  return {
    typedModule: {
      ...m,
      body: body.map(s => applySubstitutionToSyntax(s, solution))
    },
    unknowns: assumptions.unknowns.map(
      (a): TAssumption => ({
        variable: applyTypeSubstitutionToVariable(a.variable, solution),
        primaryResultingType: applySubstitution(
          a.primaryResultingType,
          solution
        )
      })
    )
  };
}

/** Run the type inference in an expression in the context on a
 * module. */
export function inferExpressionInModule(
  expr: S.Expression,
  m: S.Module<Typed>,
  externalEnv: ExternalEnvironment = defaultEnvironment,
  multipleValues: boolean
): {
  typedExpression: S.Expression<Typed>;
  unknowns: TAssumption[];
} {
  const internalTypes = moduleInternalTypes(m);
  const internalEnv = getModuleInternalEnvironment(m, internalTypes);

  const inference = infer(expr, [], internalTypes, multipleValues);

  const assumptions = groupAssumptions(
    inference.assumptions,
    internalEnv,
    externalEnv
  );

  const constraints: TConstraint[] = [
    ...inference.constraints,

    ...assumptionsToConstraints(assumptions.externals, externalEnv),

    ...assumptions.internals.map(a =>
      constImplicitInstance(a, [], internalEnv.variables[a.variable.node.name])
    )
  ];

  const solution = solve(constraints, {});

  return {
    typedExpression: applySubstitutionToExpr(inference.result, solution),
    unknowns: assumptions.unknowns.map(
      (a): TAssumption => ({
        variable: applyTypeSubstitutionToVariable(a.variable, solution),
        primaryResultingType: applySubstitution(
          a.primaryResultingType,
          solution
        )
      })
    )
  };
}

export function getModuleExternalEnvironment(
  m: S.Module<Typed>
): ExternalEnvironment {
  const defs = moduleExportedDefinitions(m);
  const variables = fromEntries(
    defs.map(d => [
      d.node.variable.name,
      generalize(d.node.value.info.resultingType, [])
    ])
  );
  return {
    variables,
    types: {}
  };
}

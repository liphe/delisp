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
  constEqual,
  constEffect,
  constExplicitInstance,
  constImplicitInstance,
  constSelfType,
  constResultingType,
  solve,
  TConstraint
} from "./infer-solver";
import {
  applyTypeSubstitutionToVariable,
  applySubstitutionToSyntax
} from "./infer-subst";
import { assertNever, InvariantViolation } from "./invariant";
import { moduleExportedDefinitions } from "./module";
import primitives from "./primitives";
import * as S from "./syntax";
import { Typed } from "./syntax-typed";
import { generateUniqueTVar } from "./type-generate";
import { type } from "./type-tag";
import {
  generalize,
  listTypeConstants,
  transformRecurType
} from "./type-utils";
import * as T from "./types";
import { Type } from "./types";
import { stronglyConnectedComponents } from "./SCC";
import {
  isDefined,
  difference,
  flatMap,
  fromEntries,
  mapObject,
  maybeMap
} from "./utils";

// A TAssumption is a variable instance for which we have assumed the
// type. Those variables are to be bound (and assumption removed)
// later, either by `let`, `lambda`, or global definitions.  Note: it
// is normal to have multiple assumptions (instances) for the same
// variable. Assumptions will be converted to additional constraints
// at the end of the inference process.
export type TAssumption = {
  variable: S.SVariableReference<Typed>;
};

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
      constResultingType(returningForm, returnType),
      ...inferred.result.map(form => constEffect(form, effectType))
    ],
    assumptions: inferred.assumptions
  };
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
      selfType: type,
      resultingType: multipleValues ? T.values([type]) : undefined,
      effect
    });
  }

  // Create metadata necessary to represent the type of an expression
  // as equal to the type of a subexpression.
  function delegatedType(effect: Type, type: Type): Typed {
    return new Typed({
      selfType: type,
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
          ...inferredValues.result.map(e => constResultingType(e, t)),
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
                constResultingType(
                  tailInferred.result,
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
          info: singleType(value.result.info.effect, labelType)
        },
        constraints: [
          ...value.constraints,
          constResultingType(value.result, recordType)
        ],
        assumptions: value.assumptions
      };
    }

    case "variable-reference": {
      const type = generateUniqueTVar();
      const effect = generateUniqueTVar();
      const typedVar = {
        ...expr,
        node: {
          ...expr.node,
          closedFunctionEffect: generateUniqueTVar(false, "closed")
        },
        info: singleType(effect, type)
      };
      return {
        result: typedVar,
        constraints: [],
        assumptions: [
          {
            variable: typedVar
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
          constResultingType(condition.result, T.boolean),
          constResultingType(consequent.result, t),
          constResultingType(alternative.result, t),

          constEffect(condition.result, effect),
          constEffect(consequent.result, effect),
          constEffect(alternative.result, effect)
        ]
      };
    }
    case "function": {
      const fnargs = expr.node.lambdaList.positionalArguments.map(a => a.name);
      const argtypes = fnargs.map(_ => generateUniqueTVar());

      const bodyEffect = generateUniqueTVar();
      const valuesType = generateUniqueTVar();
      const fnType = T.multiValuedFunction(
        argtypes,
        T.effect([], bodyEffect),
        valuesType
      );

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
            return constSelfType(a.variable, argtypes[varIndex]);
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
      const ifnInstance = generateUniqueTVar();

      const iargs = inferMany(expr.node.arguments, monovars, internalTypes);

      const primaryType = generateUniqueTVar();
      const valuesType = type`(values ${primaryType} <| _)`;
      const closedFunctionEffect = generateUniqueTVar();

      const effect = generateUniqueTVar();

      const tfn: Type = T.multiValuedFunction(
        iargs.result.map(a => a.info.resultingType),
        T.effect([], effect),
        valuesType
      );

      return {
        result: {
          ...expr,
          node: {
            ...expr.node,
            fn: ifn.result,
            arguments: iargs.result,
            closedFunctionEffect
          },
          info: multipleValues
            ? delegatedType(effect, valuesType)
            : singleType(effect, primaryType)
        },

        constraints: [
          constImplicitInstance(
            undefined,
            ifnInstance,
            monovars,
            ifn.result.info.resultingType,
            closedFunctionEffect
          ),
          constEqual(ifnInstance, tfn),

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
                a.variable,
                a.variable.info.selfType,
                monovars,
                bInfo.inference.result.info.resultingType,
                a.variable.node.closedFunctionEffect
              );
            }),

          // We require let-binding values to be free of effects
          ...bindingsInfo.map(b => constEffect(b.inference.result, T.row([])))
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
          info: delegatedType(inferred.result.info.effect, t)
        },
        assumptions: inferred.assumptions,
        constraints: [
          ...inferred.constraints,
          constSelfType(inferred.result, t)
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
                .flatMap(a => constSelfType(a.variable, vartype))
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
          constResultingType(
            value.result,
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
              constResultingType(inferredValue.result, labelType)
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
          constResultingType(form.result, T.values(variableTypes)),
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
              return constSelfType(a.variable, variableTypes[idx]);
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

export const defaultEnvironment: ExternalEnvironment = {
  variables: mapObject(primitives, prim => prim.type),
  types: {}
};

// Generate constraints for those assumptions. Note that we generate
// explicit instance constraints, as it will allow us to have
// polymoprphic types in the environment.
function externalAssumptionsToConstraints(
  assumptions: TAssumption[],
  env: ExternalEnvironment
): TConstraint[] {
  return maybeMap(a => {
    const t = lookupVariableType(a.variable.node.name, env);
    if (!t) {
      throw new InvariantViolation(
        `Assumption ${a.variable.node.name} is not bound in the external environment.`
      );
    }
    return constExplicitInstance(
      a.variable,
      a.variable.info.selfType,
      t,
      a.variable.node.closedFunctionEffect
    );
  }, assumptions);
}

function findDefinitionInGroup(
  name: string,
  inferences: Array<InferResult<S.Syntax<Typed>>>
) {
  return inferences.find(
    i => S.isDefinition(i.result) && i.result.node.variable.name === name
  );
}

function groupAssumptions(
  group: Array<InferResult<S.Syntax<Typed>>>,
  internalEnv: InternalEnvironment,
  externalEnv: ExternalEnvironment
) {
  const allAssumptions = group.flatMap(i => i.assumptions);

  // The assumptions define dependencies between different
  // variable instances and definitions. They can, then, be
  // classified according to the source of the dependency:

  // Assumptions that reference definitions within the current group.
  const groupInternals = allAssumptions.filter(a => {
    const { name } = a.variable.node;
    const def = findDefinitionInGroup(name, group);
    return def !== undefined;
  });

  const moduleAssumptions = difference(allAssumptions, groupInternals);

  const moduleInternals = moduleAssumptions.filter(
    a => a.variable.node.name in internalEnv.variables
  );
  const moduleExternals = moduleAssumptions.filter(
    a => lookupVariableType(a.variable.node.name, externalEnv) !== null
  );

  const unknowns = difference(moduleAssumptions, [
    ...moduleInternals,
    ...moduleExternals
  ]);

  return { groupInternals, moduleInternals, moduleExternals, unknowns };
}

// Resolve a set of inferences in a given environment.
//
// This will resolve as many assumptions as possible, converting them
// in additional constraints. The unknown assumptions are also
// returned so we can report them back to the user.
function resolveInferenceEnvironment(
  inferences: Array<InferResult<S.Syntax<Typed>>>,
  internalEnv: InternalEnvironment,
  externalEnv: ExternalEnvironment
): { constraints: TConstraint[]; unknowns: TAssumption[] } {
  // Find a defiition in the group of inferences

  // The body inferences depend on the type of the definitions in the
  // module by the returned assumptions.
  //
  // As it is not possible to type polymophic recursion, we'll group
  // the forms that are mutually dependent and apply monomorphic
  // constraints instead.
  const inferenceGroups = stronglyConnectedComponents(inferences, inference => {
    const dependencies = inference.assumptions.map(a =>
      findDefinitionInGroup(a.variable.node.name, inferences)
    );
    return dependencies.filter(isDefined);
  });

  return inferenceGroups
    .map(group => {
      const {
        groupInternals,
        moduleInternals,
        moduleExternals,
        unknowns
      } = groupAssumptions(group, internalEnv, externalEnv);

      const constraints: TConstraint[] = [
        ...inferences.flatMap(i => i.constraints),
        ...groupInternals.map(a =>
          constSelfType(a.variable, internalEnv.variables[a.variable.node.name])
        ),
        ...moduleInternals.map(a =>
          constImplicitInstance(
            a.variable,
            a.variable.info.selfType,
            [],
            internalEnv.variables[a.variable.node.name],
            a.variable.node.closedFunctionEffect
          )
        ),
        ...externalAssumptionsToConstraints(moduleExternals, externalEnv)
      ];

      return { constraints, unknowns };
    })
    .reduce(
      (acc, result) => ({
        constraints: [...acc.constraints, ...result.constraints],
        unknowns: [...acc.unknowns, ...result.unknowns]
      }),
      {
        constraints: [],
        unknowns: []
      }
    );
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

  const { constraints, unknowns } = resolveInferenceEnvironment(
    bodyInferences,
    internalEnv,
    externalEnv
  );

  const solution = solve(constraints, {});

  return {
    typedModule: {
      ...m,
      body: body.map(s => applySubstitutionToSyntax(s, solution))
    },
    unknowns: unknowns.map(
      (a): TAssumption => ({
        variable: applyTypeSubstitutionToVariable(a.variable, solution)
      })
    )
  };
}

/** Run the type inference in a syntax in the context on a module. */
export function inferSyntaxInModule(
  syntax: S.Syntax,
  m: S.Module<Typed>,
  externalEnv: ExternalEnvironment = defaultEnvironment
): {
  typedSyntax: S.Syntax<Typed>;
  unknowns: TAssumption[];
} {
  const internalTypes = moduleInternalTypes(m);
  const internalEnv = getModuleInternalEnvironment(m, internalTypes);

  const inference = inferSyntax(syntax, internalTypes);

  const { constraints, unknowns } = resolveInferenceEnvironment(
    [inference],
    internalEnv,
    externalEnv
  );

  const solution = solve(constraints, {});

  return {
    typedSyntax: applySubstitutionToSyntax(inference.result, solution),
    unknowns: unknowns.map(
      (a): TAssumption => ({
        variable: applyTypeSubstitutionToVariable(a.variable, solution)
      })
    )
  };
}

export function inferExpressionInModule(
  expr: S.Expression,
  m: S.Module<Typed>,
  externalEnv: ExternalEnvironment = defaultEnvironment
): {
  typedExpression: S.Expression<Typed>;
  unknowns: TAssumption[];
} {
  const result = inferSyntaxInModule(expr, m, externalEnv);
  if (!S.isExpression(result.typedSyntax)) {
    throw new InvariantViolation(
      `Infering an expression must return a typed expression.`
    );
  }
  return {
    typedExpression: result.typedSyntax,
    unknowns: result.unknowns
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

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
import { typeAnnotate } from "./infer-debug";
import { ExternalEnvironment } from "./infer-environment";
import {
  constEffect,
  constEqual,
  constExplicitInstance,
  constImplicitInstance,
  debugConstraints,
  solve,
  TConstraint
} from "./infer-solver";
import { applySubstitutionToExpr } from "./infer-subst";
import { assertNever, InvariantViolation } from "./invariant";
import { moduleExportedDefinitions } from "./module";
import primitives from "./primitives";
import { pprint } from "./printer";
import * as S from "./syntax";
import {
  lambdaListAllArguments,
  funcallAllArguments
} from "./syntax-functions";
import { generateUniqueTVar } from "./type-generate";
import { type } from "./type-tag";
import {
  generalize,
  listTypeConstants,
  Substitution,
  transformRecurType
} from "./type-utils";
import * as T from "./types";
import { Type } from "./types";
import { difference, flatMap, fromEntries, mapObject, maybeMap } from "./utils";

const DEBUG = false;

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
type TAssumption = S.SVariableReference<S.Typed>;

interface InferResult<A> {
  result: A;
  constraints: TConstraint[];
  assumptions: TAssumption[];
}

function inferMany(
  exprs: S.Expression[],
  monovars: string[],
  internalTypes: InternalTypeEnvironment,
  options = {
    multipleValuedLastForm: false
  }
): InferResult<Array<S.Expression<S.Typed>>> {
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
  monovars: string[],
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
      constEqual(returningForm, returnType, "resulting-type"),
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
  monovars: string[],
  // Known type aliases that must be expanded
  internalTypes: InternalTypeEnvironment,

  // True if the caller wants the _resulting type_ to be a
  // multi-valued type. For many forms, being multipleValues or not
  // depends on if the parent itself is multipleValued. If that's the
  // case, just pass the value down to the subexpressions.
  multipleValues: boolean
): InferResult<S.Expression<S.Typed>> {
  function singleType(effect: Type, type: Type): S.Typed {
    return new S.Typed({
      expressionType: type,
      resultingType: multipleValues ? T.values([type]) : undefined,
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
          ...inferredValues.result.map(e => constEqual(e, t, "resulting-type")),
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
                  T.record(
                    expr.node.source.extending
                      ? []
                      : inferred.map(i => ({
                          label: i.label.name,
                          type: generateUniqueTVar()
                        })),
                    tailRowType
                  ),
                  "resulting-type"
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
          constEqual(value.result, recordType, "resulting-type"),
          constEffect(value.result, effect)
        ],
        assumptions: value.assumptions
      };
    }

    case "variable-reference": {
      const t = generateUniqueTVar();
      const effect = generateUniqueTVar();
      const typedVar = {
        ...expr,
        node: {
          ...expr.node
        },
        info: singleType(effect, t)
      };
      return {
        result: typedVar,
        constraints: [],
        assumptions: [typedVar]
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
          info: new S.Typed({
            effect,
            expressionType: t
          })
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
          constEqual(condition.result, T.boolean, "resulting-type"),
          constEqual(consequent.result, t, "resulting-type"),
          constEqual(alternative.result, t, "resulting-type"),

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
        [...monovars, ...argtypes.map(v => v.node.name)],
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
          .filter(v => fnargs.includes(v.node.name))
          .map(v => {
            const varIndex = fnargs.indexOf(v.node.name);
            return constEqual(v, argtypes[varIndex], "expression-type");
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
        assumptions: assumptions.filter(v => !fnargs.includes(v.node.name))
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
          info: new S.Typed({
            effect,
            expressionType: valuesType,
            resultingType: multipleValues ? valuesType : primaryType
          })
        },

        constraints: [
          constEqual(ifn.result, tfn, "resulting-type"),
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
          info: new S.Typed({ effect, expressionType: t })
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
                bInfo.inference.result.info.resultingType,
                "expression-type"
              );
            }),

          // We require let-binding values to be free of effects
          ...bindingsInfo.map(b =>
            constEffect(b.inference.result, T.effect([]))
          )
        ],
        assumptions: [
          ...bodyInference.assumptions.filter(v => !toBeBound(v.node.name)),
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
          info: new S.Typed({ effect, expressionType: t })
        },
        assumptions: inferred.assumptions,
        constraints: [
          ...inferred.constraints,
          constEqual(inferred.result, t, "expression-type"),
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
          info: new S.Typed({
            effect,
            expressionType: returning.result.info.resultingType
          })
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
        return {
          ...c,
          infer: inferBody(
            c.body,
            [...monovars, c.variable.name],
            internalTypes,
            t,
            effect,
            multipleValues
          )
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

      const variantTypes = expr.node.cases.map(c => ({
        label: c.label,
        type: generateUniqueTVar()
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
          info: new S.Typed({ effect, expressionType: t })
        },

        constraints: [
          ...value.constraints,
          ...flatMap(c => c.infer.constraints, cases),
          ...(defaultCase ? defaultCase.constraints : []),

          // Value must produce a value of type with all the variants
          // that `match` is handling.
          constEqual(
            value.result,
            T.cases(
              variantTypes,
              defaultCase ? generateUniqueTVar() : undefined
            ),
            "resulting-type"
          ),
          constEffect(value.result, effect),

          ...flatMap(c => {
            return [
              // The pattern variable of each case must be the same
              // type as the variant we are handling.
              ...flatMap(a => {
                if (a.node.name === c.variable.name) {
                  const variant = variantTypes.find(v => v.label === c.label);
                  if (!variant) {
                    throw new InvariantViolation(
                      `Unknown invariant case ${c.label}`
                    );
                  }
                  return [constEqual(a, variant.type, "expression-type")];
                } else {
                  return [];
                }
              }, c.infer.assumptions)
            ];
          }, cases),

          ...(defaultCase ? defaultCase.constraints : [])
        ],

        assumptions: [
          ...value.assumptions,
          ...flatMap(
            c =>
              c.infer.assumptions.filter(a => a.node.name !== c.variable.name),
            cases
          ),
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
              constEqual(inferredValue.result, labelType, "resulting-type")
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
          info: new S.Typed({
            effect,
            expressionType: tValuesType,
            resultingType: multipleValues ? tValuesType : tPrimaryType
          })
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
        [...monovars, ...expr.node.variables.map(v => v.name)],
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
          info: new S.Typed({
            effect,
            expressionType: t
          })
        },

        constraints: [
          ...form.constraints,
          constEqual(form.result, T.values(variableTypes), "resulting-type"),
          constEffect(form.result, effect),

          ...body.constraints,
          ...body.assumptions
            .filter(a => variableNames.includes(a.node.name))
            .map(a => {
              const name = a.node.name;
              const idx = variableNames.indexOf(name);
              if (idx < 0) {
                throw new InvariantViolation(
                  `Could not find variable in the list of assumptions.`
                );
              }
              return constEqual(a, variableTypes[idx], "expression-type");
            })
        ],

        assumptions: [
          ...form.assumptions,
          ...body.assumptions.filter(a => !variableNames.includes(a.node.name))
        ]
      };
    }
  }
}

function inferSyntax(
  syntax: S.Syntax,
  internalTypes: InternalTypeEnvironment
): InferResult<S.Syntax<S.Typed>> {
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
    const t = lookupVariableType(a.node.name, env);
    return t && constExplicitInstance(a, t, "expression-type");
  }, assumptions);
}

function applySubstitutionToSyntax(
  s: S.Syntax<S.Typed>,
  env: Substitution
): S.Syntax<S.Typed> {
  if (S.isExpression(s)) {
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
  } else if (s.node.tag === "import") {
    return s;
  } else {
    return assertNever(s.node);
  }
}

export const defaultEnvironment: ExternalEnvironment = {
  variables: mapObject(primitives, prim => prim.type),
  types: {}
};

export function inferType(
  expr: S.Expression,
  env: ExternalEnvironment = defaultEnvironment,
  internalTypes: InternalTypeEnvironment,
  multipleValues: boolean
): S.Expression<S.Typed> {
  const { result: tmpExpr, constraints, assumptions } = infer(
    expr,
    [],
    internalTypes,
    multipleValues
  );

  const allConstraints = [
    ...constraints,
    ...assumptionsToConstraints(assumptions, env)
  ];

  const s = solve(allConstraints, {});

  const result = applySubstitutionToExpr(tmpExpr, s);

  if (DEBUG) {
    console.log("———————————–");
    const debug = typeAnnotate(tmpExpr);
    console.log(pprint(debug, 40));

    console.log("");
    console.log("Constraints:");
    debugConstraints(allConstraints);

    console.log("");
    console.log("Result");
    console.log(pprint(typeAnnotate(result), 40));
  }

  return result;
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
  m: S.Module<S.Typed>,
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
  typedModule: S.Module<S.Typed>;
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

    ...assumptions.internals.map(v =>
      constImplicitInstance(
        v,
        [],
        internalEnv.variables[v.node.name],
        "expression-type"
      )
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
        return applySubstitutionToExpr(v, solution) as S.SVariableReference<
          S.Typed
        >;
      }
    )
  };
}

/** Run the type inference in an expression in the context on a
 * module. */
export function inferExpressionInModule(
  expr: S.Expression,
  m: S.Module<S.Typed>,
  externalEnv: ExternalEnvironment = defaultEnvironment,
  multipleValues: boolean
): {
  typedExpression: S.Expression<S.Typed>;
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

    ...assumptions.internals.map(v =>
      constImplicitInstance(
        v,
        [],
        internalEnv.variables[v.node.name],
        "expression-type"
      )
    )
  ];

  const solution = solve(constraints, {});

  return {
    typedExpression: applySubstitutionToExpr(inference.result, solution),
    unknowns: assumptions.unknowns.map(
      (v): TAssumption => {
        return applySubstitutionToExpr(v, solution) as S.SVariableReference<
          S.Typed
        >;
      }
    )
  };
}

export function getModuleExternalEnvironment(
  m: S.Module<S.Typed>
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

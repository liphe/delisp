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

import { TApplication, TNumber, TString, TVar, Monotype } from "./types";

import { applySubstitution, unify } from "./unify";

import { flatten, unique } from "./utils";

type TConstraint = [Monotype, Monotype];
type TAssumption = [SVar, Monotype];

let generateUniqueTVarIdx = 0;
const generateUniqueTVar = (): TVar => ({
  type: "type-variable",
  name: `t${++generateUniqueTVarIdx}`
});

function infer(
  syntax: Expression
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
      const { type, constraints, assumptions } = infer(syntax.body);
      const fnargs = functionArgs(syntax);
      const argtypes = fnargs.map(_ => generateUniqueTVar());
      const newConstraints: TConstraint[] = [
        ...assumptions.filter(([v, _]) => fnargs.includes(v)).map(([v, t]) => {
          const varIndex = fnargs.indexOf(v);
          const constraint: TConstraint = [t, argtypes[varIndex]];
          return constraint;
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
      const ifn = infer(syntax.fn);
      const iargs = syntax.args.map(arg => infer(arg));
      const tTo = generateUniqueTVar();

      const tfn: Monotype = {
        type: "application",
        op: "->",
        args: [...iargs.map(a => a.type), tTo]
      };

      return {
        type: tTo,
        constraints: ([[ifn.type, tfn]] as TConstraint[]).concat(
          ...ifn.constraints,
          ...iargs.map(a => a.constraints)
        ),
        assumptions: ifn.assumptions.concat(...iargs.map(a => a.assumptions))
      };
    }

    case "let-bindings":
      throw new Error(`not supported yet`);
  }
}

export interface TypeEnvironment {
  [v: string]: Monotype;
}

function assumptionsToConstraints(
  assumptions: TAssumption[],
  typeEnvironment: TypeEnvironment
): TConstraint[] {
  return flatten(
    Object.keys(typeEnvironment).map(v =>
      assumptions
        .filter(([aVar, aType]) => aVar === v)
        .map(([_, aType]): TConstraint => [aType, typeEnvironment[v]])
    )
  );
}

export function inferType(
  expr: Expression,
  typeEnvironment: TypeEnvironment = {}
): Monotype {
  const { type, constraints, assumptions } = infer(expr);

  const effectiveConstraints = [
    ...constraints,
    ...assumptionsToConstraints(assumptions, typeEnvironment)
  ];

  const s = effectiveConstraints.reduce(
    (env, [t1, t2]) => unify(t1, t2, env),
    {}
  );

  return applySubstitution(type, s);
}

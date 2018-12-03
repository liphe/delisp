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

import { TFunction, TNumber, TString, TVar, Type, printType } from "./types";

type TConstraint = [Type, Type];
type TAssumption = [SVar, Type];

let generateUniqueTVarIdx = 0;
const generateUniqueTVar = (): TVar => ({
  type: "type-variable",
  name: `t${++generateUniqueTVarIdx}`
});

function infer(
  syntax: Expression
): { type: Type; constraints: TConstraint[]; assumptions: TAssumption[] } {
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
          type: "function",
          from: argtypes,
          to: type
        },
        constraints: constraints.concat(newConstraints),
        assumptions: assumptions.filter(([v, _]) => !fnargs.includes(v))
      };
    }
    case "function-call": {
      const ifn = infer(syntax.fn);
      const iargs = syntax.args.map(arg => infer(arg));

      const tfn = {
        type: "function",
        from: iargs.map(a => a.type),
        to: generateUniqueTVar()
      };

      return {
        type: tfn.to,
        constraints: ([[ifn.type, tfn]] as TConstraint[]).concat(
          ...ifn.constraints,
          ...iargs.map(a => a.constraints)
        ),
        assumptions: ifn.assumptions.concat(...iargs.map(a => a.assumptions))
      };
    }
  }
}

/* tslint:disable:no-console */
function debugInfer(expr: Expression) {
  const result = infer(expr);
  console.log("Type: ", printType(result.type));
  console.log("Constraints: ");
  result.constraints.forEach(c => {
    console.log("  " + printType(c[0]) + "  ===  " + printType(c[1]));
  });
  console.log("Assumptions: ");
  result.assumptions.forEach(([v, t]) => {
    console.log(" " + v + " === " + printType(t));
  });
}
/* tslint:enable:no-console */

// function solve(contraints: TConstraint[]): Substitution | TError {
//   return [];
// }

// function applySubst(type: Type, subs: Substitution): Type {}

// function inferType(syntax: Syntax, env: TEnv): Type {
//   const result = infer(syntax);
//   const solution = solve(result.constraints);
//   return applySubst(result.type, solution);
// }

// import { readFromString } from "./reader";
// import { convertExpr } from "./convert";
// debugInfer(convertExpr(readFromString("(lambda (f x) y)")));

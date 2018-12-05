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

import { printType, TApplication, TNumber, TString, TVar, Type } from "./types";

import { unify, applySubstitution } from "./unify";

import { flatten, unique } from "./utils";

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
        ...assumptions
          .filter(([v, _]) => fnargs.includes(v))
          .map(([v, t]) => {
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

      const tfn: Type = {
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

import { readFromString } from "./reader";
import { convertExpr } from "./convert";

const { type, constraints, assumptions } = infer(
  convertExpr(readFromString("(lambda (f x) (f x))"))
);

const s = constraints.reduce((env, [t1, t2]) => unify(t1, t2, env), {});

const result = applySubstitution(type, s);

// Return the list of type variables in the order they show up
function listTypeVariables(t: Type): string[] {
  switch (t.type) {
    case "string":
      return [];
    case "number":
      return [];
    case "application":
      return unique(flatten(t.args.map(listTypeVariables)));
    case "type-variable":
      return [t.name];
  }
}

function typeIndexName(index: number): string {
  const alphabet = "αβγδεζηθικμνξοπρστυφχψ";
  return index < alphabet.length
    ? alphabet[index]
    : `ω${index - alphabet.length + 1}`;
}

function normalizeType(t: Type): Type {
  const vars = listTypeVariables(t);
  const substitution = vars.reduce((s, v, i) => {
    return {
      ...s,
      [v]: {
        type: "type-variable",
        name: typeIndexName(i)
      }
    };
  }, {});
  return applySubstitution(t, substitution);
}

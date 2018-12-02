import { Expression, functionArgs, SVar } from "./syntax";

//
// Types
//

interface TNumber {
  type: "number";
}

interface TString {
  type: "string";
}

interface TFunction {
  type: "function";
  from: Type[];
  to: Type;
}

interface TVar {
  type: "type-variable";
  name: string;
}

type Type = TNumber | TString | TFunction | TVar;

type TConstraint = [Type, Type];
type TAssumption = [SVar, Type];

let x = 0;
const generateUniqueTVar = (): TVar => ({
  type: "type-variable",
  name: `t${++x}`
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

function printType(type: Type): string {
  switch (type.type) {
    case "function":
      return `(-> (${type.from.map(printType).join(" ")}) ${printType(
        type.to
      )})`;
    case "number":
      return "number";
    case "string":
      return "string";
    case "type-variable":
      return type.name;
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

// debugInfer({
//   type: "function",
//   args: ["x"],
//   body: {
//     type: "function-call",
//     fn: { type: "variable-reference", variable: "f" },
//     args: [{ type: "variable-reference", variable: "x" }]
//   }
// });

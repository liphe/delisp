import { InvariantViolation, assertNever } from "./invariant";
import { Expression } from "./syntax";
import { Type, tString, tNumber } from "./types";
import { unify } from "./unify";
import { printType } from "./type-printer";
import { last } from "./utils";
import { Location } from "./input";
import { printHighlightedExpr } from "./error-report";

export interface Environment {
  [variable: string]: Type;
}

function equalTypes(t1: Type, t2: Type): boolean {
  // Quick and dirty equality definition for trying out.
  const result = unify(t1, t2, {});
  return (
    result.tag === "unify-success" &&
    Object.keys(result.substitution).length === 0
  );
}

function typeError(message: string, entity: { location: Location }) {
  return new Error(printHighlightedExpr(message, entity.location));
}

export function infer(expr: Expression, env: Environment): Type | null {
  switch (expr.node.tag) {
    case "string":
      return tString;
    case "number":
      return tNumber;
    case "variable-reference": {
      const variableName = expr.node.name;
      const variableType = env[variableName];
      if (!variableType) {
        throw typeError(`Unknown variable ${variableName}`, expr);
      }
      return variableType;
    }
    case "type-annotation": {
      const typ = expr.node.typeWithWildcards.instantiate();
      check(expr.node.value, typ, env);
      return typ;
    }
    case "function-call": {
      const fnType = infer(expr.node.fn, env);
      if (!fnType) {
        throw typeError(
          `Can't called a function with unknown type.`,
          expr.node.fn
        );
      }

      if (
        !(
          fnType.node.tag === "application" &&
          fnType.node.op.node.tag === "constant" &&
          fnType.node.op.node.name === "->"
        )
      ) {
        throw typeError(
          `Looks like you are trying to do a function call on a ${printType(
            fnType
          )}`,
          expr.node.fn
        );
      }

      const argTypes = fnType.node.args.slice(0, -1);
      const outType = last(fnType.node.args);
      if (!outType) {
        throw new InvariantViolation(`Function with no output type?`);
      }

      expr.node.args.forEach((arg, i) => {
        check(arg, argTypes[i], env);
      });

      return outType;
    }

    default:
      return null;
  }
}

export function check(expr: Expression, type: Type, env: Environment) {
  switch (expr.node.tag) {
    case "string":
    case "number":
    case "variable-reference":
    case "type-annotation":
    case "function-call": {
      const inferred = infer(expr, env);
      if (inferred) {
        if (!equalTypes(inferred, type)) {
          throw typeError(
            `Expected type ${printType(type, false)}, but found ${printType(
              inferred
            )}.`,
            expr
          );
        }
      }
      return;
    }
    case "function": {
      if (
        !(
          type.node.tag === "application" &&
          type.node.op.node.tag === "constant" &&
          type.node.op.node.name === "->"
        )
      ) {
        throw typeError(
          `Expected a function, but found ${printType(type)}`,
          expr
        );
      }

      const argTypes = type.node.args.slice(0, -1);
      const outType = last(type.node.args);
      if (!outType) {
        throw new InvariantViolation(`Function with no output type?`);
      }

      const args = expr.node.lambdaList.positionalArgs.map(i => i.name);

      if (argTypes.length !== args.length) {
        throw typeError(
          `Wrong number of arguments. Expected ${argTypes.length} but found ${
            args.length
          }`,
          expr.node.lambdaList
        );
      }

      const newEnv = args.reduce(
        (tmpEnv, a, idx) => ({
          ...tmpEnv,
          [a]: argTypes[idx]
        }),
        env
      );

      check(last(expr.node.body)!, outType, newEnv);
      return;
    }
    case "conditional":
    case "let-bindings":
    case "record":
    case "vector":
      throw typeError(
        `Cannot check this expression for type ${printType(type)}.`,
        expr
      );
    default:
      assertNever(expr.node);
  }
}

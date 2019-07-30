//
// Evaluation
//

import * as runtime from "@delisp/runtime";
import * as vm from "vm";
import {
  compileModuleToString,
  compileToString,
  Environment
} from "./compiler";
import { Host } from "./host";
import primitives from "./primitives";
import * as S from "./syntax";
import { mapObject } from "./utils";

type Sandbox = ReturnType<typeof createSandbox>;

export function createSandbox(requireFn: (id: string) => any) {
  const sandbox = {
    env: mapObject(primitives, p => p.value),
    console,
    require: requireFn,
    ...runtime
  };
  vm.createContext(sandbox);
  return sandbox;
}

function compileAndRun(s: S.Syntax, env: Environment, sandbox: Sandbox) {
  const code = compileToString(s, env);
  return vm.runInContext(code, sandbox);
}

export async function evaluateExpression(
  expression: S.Expression,
  env: Environment,
  sandbox: Sandbox
): Promise<unknown> {
  const wrapped: S.Expression = {
    node: {
      tag: "function",
      lambdaList: {
        tag: "function-lambda-list",
        positionalArguments: [],
        location: expression.location
      },
      body: [expression]
    },
    info: {},
    location: expression.location
  };
  const result = compileAndRun(wrapped, env, sandbox);
  return result((x: unknown) => x, {});
}

export async function evaluate(
  syntax: S.Syntax,
  env: Environment,
  sandbox: Sandbox
): Promise<unknown> {
  if (S.isExpression(syntax)) {
    return evaluateExpression(syntax, env, sandbox);
  } else {
    const result = compileAndRun(syntax, env, sandbox);
    return result;
  }
}

export function evaluateModule(
  m: S.Module,
  sandbox: Sandbox,
  host: Host
): void {
  const code = compileModuleToString(m, {
    definitionContainer: "env",
    getOutputFile: host.getOutputFile
  });
  vm.runInContext(code, sandbox);
  return;
}

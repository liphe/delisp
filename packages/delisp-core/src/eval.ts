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

export async function evaluate(
  syntax: S.Syntax,
  env: Environment,
  sandbox: Sandbox
): Promise<unknown> {
  if (!S.isExpression(syntax)) {
    throw new Error(`Definitions aren't supported in the REPL.`);
  }

  const wrappedSyntax: S.Expression = {
    node: {
      tag: "function",
      lambdaList: {
        tag: "function-lambda-list",
        positionalArguments: [],
        location: syntax.location
      },
      body: [syntax]
    },
    info: {},
    location: syntax.location
  };

  const code = compileToString(wrappedSyntax, env);
  const result = vm.runInContext(code, sandbox);
  return result((x: any) => x, {});
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

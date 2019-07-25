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
import { Module, Syntax } from "./syntax";
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

export function evaluate(
  syntax: Syntax,
  env: Environment,
  sandbox: Sandbox
): unknown {
  const code = compileToString(syntax, env);
  const result = vm.runInContext(code, sandbox);
  return result;
}

export function evaluateModule(m: Module, sandbox: Sandbox, host: Host): void {
  const code = compileModuleToString(m, {
    definitionContainer: "env",
    getOutputFile: host.getOutputFile
  });
  vm.runInContext(code, sandbox);
  return;
}

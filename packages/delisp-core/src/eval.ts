//
// Evaluation
//

import * as vm from "vm";
import { compileToString, Environment, moduleEnvironment } from "./compiler";
import primitives from "./primitives";
import { Module, Syntax } from "./syntax";
import { mapObject } from "./utils";

export function createContext() {
  const sandbox = {
    env: mapObject(primitives, p => p.value),
    console
  };
  vm.createContext(sandbox);
  return sandbox;
}

export function evaluate(
  syntax: Syntax,
  env: Environment,
  context = createContext()
): unknown {
  const code = compileToString(syntax, env);
  const result = vm.runInContext(code, context);
  return result;
}

export function evaluateModule(m: Module, context = createContext()): void {
  const env = moduleEnvironment(m, { definitionContainer: "env" });
  m.body.forEach(s => {
    return evaluate(s, env, context);
  });
}

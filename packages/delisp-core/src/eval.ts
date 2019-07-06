//
// Evaluation
//

import * as vm from "vm";
import {
  compileModuleToString,
  compileToString,
  Environment
} from "./compiler";
import primitives from "./primitives";
import { Module, Syntax } from "./syntax";
import { mapObject } from "./utils";

import {
  caseTag,
  matchTag,
  primPair,
  primFst,
  primSnd,
  values,
  primaryValue,
  bindPrimaryValue,
  mvbind,
  assert
} from "@delisp/runtime";

import { Host } from "./host";

type Context = ReturnType<typeof createContext>;

export function createContext() {
  const sandbox = {
    env: mapObject(primitives, p => p.value),
    console,
    // Primitives
    caseTag,
    matchTag,
    primPair,
    primFst,
    primSnd,
    values,
    primaryValue,
    bindPrimaryValue,
    mvbind,
    assert,
    require
  };
  vm.createContext(sandbox);
  return sandbox;
}

export function evaluate(
  syntax: Syntax,
  env: Environment,
  context: Context
): unknown {
  const code = compileToString(syntax, env);
  const result = vm.runInContext(code, context);
  return result;
}

export function evaluateModule(m: Module, context: Context, host: Host): void {
  const code = compileModuleToString(m, {
    definitionContainer: "env",
    getOutputFile: host.getOutputFile
  });
  vm.runInContext(code, context);
  return;
}

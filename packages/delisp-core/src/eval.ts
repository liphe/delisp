//
// Evaluation
//

import * as vm from "vm";
import { compileToString } from "./compiler";
import primitives from "./primitives";
import { Syntax } from "./syntax";
import { mapObject } from "./utils";

export function createContext() {
  const sandbox = {
    env: mapObject(primitives, p => p.value)
  };
  vm.createContext(sandbox);
  return sandbox;
}

export function evaluate(syntax: Syntax, context = createContext()): unknown {
  const code = compileToString(syntax);
  const result = vm.runInContext(code, context);
  return result;
}

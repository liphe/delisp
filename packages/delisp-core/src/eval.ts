//
// Evaluation
//

import * as vm from "vm";

import { ASExpr } from "./syntax";
import { readFromString } from "./reader";
import { compileToString } from "./compiler";

const sandbox = {
  env: {
    foo: 42,
    log: (...args: any) => console.log(...args),
    "+": (a: number, b: number) => a + b,
    "*": (a: number, b: number) => a * b
  }
};
vm.createContext(sandbox);

export function evaluate(syntax: ASExpr): unknown {
  const code = compileToString(syntax);
  const result = vm.runInContext(code, sandbox);
  return result;
}

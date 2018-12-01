//
// Evaluation
//

import * as vm from "vm";

import { convert } from "./convert";
import { compileToString } from "./compiler";
import { readFromString } from "./reader";
import { ASExpr } from "./sexpr";

const sandbox = {
  env: {
    foo: 42,
    log: (...args: any) => console.log(...args),
    "+": (a: number, b: number) => a + b,
    "*": (a: number, b: number) => a * b
  }
};
vm.createContext(sandbox);

export function evaluate(sexpr: ASExpr): unknown {
  const syntax = convert(sexpr);
  const code = compileToString(syntax);
  const result = vm.runInContext(code, sandbox);
  return result;
}

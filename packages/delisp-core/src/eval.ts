//
// Evaluation
//

import * as vm from "vm";

import { compileToString } from "./compiler";
import { convert } from "./convert";
import { readFromString } from "./reader";
import { ASExpr } from "./sexpr";

const sandbox = {
  env: {
    foo: 42,
    log: (...args: any) => {
      /* tslint:disable:no-console */
      console.log(...args);
      /* tslint:enable:no-console */
    },
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

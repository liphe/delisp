//
// Evaluation
//

import * as vm from "vm";
import { compileToString } from "./compiler";
import primitives from "./primitives";
import { Syntax } from "./syntax";
import { mapObject } from "./utils";

const sandbox = {
  env: mapObject(primitives, p => p.value)
};
vm.createContext(sandbox);

export function evaluate(syntax: Syntax): unknown {
  const code = compileToString(syntax);
  const result = vm.runInContext(code, sandbox);
  return result;
}

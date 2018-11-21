import repl from "repl";
import * as vm from "vm";

import { readFromString, compileToString } from "@delisp/core";

const debug = require("debug")("delisp:repl");

const sandbox = {
  env: {
    foo: 42,
    log: (...args: any) => console.log(...args),
    "+": (a: number, b: number) => a + b,
    "*": (a: number, b: number) => a * b
  }
};
vm.createContext(sandbox);

const delispEval = (
  cmd: string,
  _context: object,
  _filename: string,
  callback: Function
) => {
  const ast = readFromString(cmd);
  debug("delispast:", ast);
  const code = compileToString(ast);
  debug({ code });
  const result = vm.runInContext(code, sandbox);
  callback(null, result);
};

const replServer = repl.start({ prompt: "λ ", eval: delispEval });

replServer.on("exit", () => {
  console.log("\n; bye!");
  process.exit(0);
});

import repl from "repl";

import { readFromString } from "@delisp/core";

const delispEval = (
  cmd: string,
  _context: object,
  _filename: string,
  callback: Function
) => {
  callback(null, readFromString(cmd));
};

const replServer = repl.start({ prompt: "λ ", eval: delispEval });

replServer.on("exit", () => {
  console.log("\n; bye!");
  process.exit(0);
});

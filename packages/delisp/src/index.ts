import repl from "repl";
import { readFromString, evaluate } from "@delisp/core";

const delispEval = (
  cmd: string,
  _context: object,
  _filename: string,
  callback: Function
) => {
  const syntax = readFromString(cmd);
  const result = evaluate(syntax);
  callback(null, result);
};

const replServer = repl.start({ prompt: "λ ", eval: delispEval });

replServer.on("exit", () => {
  console.log("\n; bye!");
  process.exit(0);
});

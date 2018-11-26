import repl from "repl";
import { readFromString, evaluate } from "@delisp/core";

const delispEval = (
  cmd: string,
  _context: object,
  _filename: string,
  callback: Function
) => {
  let syntax;
  try {
    syntax = readFromString(cmd);
  } catch (err) {
    if (err.incomplete) {
      return callback(new repl.Recoverable(err));
    } else {
      throw err;
    }
  }
  const result = evaluate(syntax);
  callback(null, result);
};

const replServer = repl.start({ prompt: "λ ", eval: delispEval });

replServer.on("exit", () => {
  console.log("\n; bye!");
  process.exit(0);
});

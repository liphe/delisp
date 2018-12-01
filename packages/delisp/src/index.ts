import { evaluate, readFromString } from "@delisp/core";
import repl from "repl";

const delispEval = (
  cmd: string,
  _context: object,
  _filename: string,
  callback: (err: Error | null, result?: unknown) => void
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
  // tslint:disable no-console
  console.log("\n; bye!");
  // tslint:enable no-console
  process.exit(0);
});

import {
  evaluate,
  inferType,
  isDeclaration,
  printType,
  readSyntax
} from "@delisp/core";
import repl from "repl";

const delispEval = (
  cmd: string,
  _context: object,
  _filename: string,
  callback: (err: Error | null, result?: unknown) => void
) => {
  let syntax;
  try {
    syntax = readSyntax(cmd);
  } catch (err) {
    if (err.incomplete) {
      return callback(new repl.Recoverable(err));
    } else {
      throw err;
    }
  }

  // NOTE: evaluate doesn't really make sense for declarations. Let's rethink this
  const value = evaluate(syntax);

  if (isDeclaration(syntax)) {
    callback(null, {});
  } else {
    const type = inferType(syntax);
    callback(null, { value, type: printType(type) });
  }
};

export function startREPL() {
  const replServer = repl.start({ prompt: "λ ", eval: delispEval });
  replServer.on("exit", () => {
    // tslint:disable no-console
    console.log("\n; bye!");
    // tslint:enable no-console
    process.exit(0);
  });
}

// tslint:disable no-console

import {
  addToModule,
  createContext,
  createModule,
  evaluate,
  inferModule,
  isDeclaration,
  moduleEnvironment,
  printType,
  readSyntax,
  removeModuleDefinition
} from "@delisp/core";

import { Typed } from "@delisp/core/src/infer";
import { Module, Syntax } from "@delisp/core/src/syntax";

import repl from "repl";

let previousModule = createModule();
const context = createContext();

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

  //
  // Type checking
  //

  // The current module, extended with the current form
  let m;

  if (isDeclaration(syntax)) {
    previousModule = removeModuleDefinition(previousModule, syntax.variable);
    previousModule = addToModule(previousModule, syntax);
    m = previousModule;
  } else {
    m = addToModule(previousModule, syntax);
  }

  let typedModule: Module<Typed> | undefined;
  try {
    const result = inferModule(m);
    typedModule = result.typedModule;
    result.unknowns.forEach(v => {
      console.warn(
        `Unknown variable ${v.name} expected with type ${printType(
          v.info.type
        )}`
      );
    });
  } catch (err) {
    console.log("TYPE WARNING:");
    console.log(err);
  }

  const typedSyntax: Syntax<Typed> | null = typedModule
    ? typedModule.body.slice(-1)[0]
    : null;

  //
  // Evaluation
  //

  const env = moduleEnvironment(previousModule, "env");
  const value = evaluate(syntax, env, context);

  if (isDeclaration(syntax)) {
    const type =
      typedSyntax && isDeclaration(typedSyntax)
        ? typedSyntax.value.info.type
        : null;

    callback(null, {
      type: type && printType(type)
    });
  } else {
    const type =
      typedSyntax && !isDeclaration(typedSyntax) ? typedSyntax.info.type : null;

    callback(null, {
      value,
      type: type && printType(type)
    });
  }
};

export function startREPL() {
  const replServer = repl.start({ prompt: "λ ", eval: delispEval });
  replServer.on("exit", () => {
    console.log("\n; bye!");
    process.exit(0);
  });
}

// tslint:enable no-console

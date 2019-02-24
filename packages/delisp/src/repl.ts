// tslint:disable no-console

import {
  addToModule,
  createContext,
  createModule,
  evaluate,
  inferModule,
  isDeclaration,
  isDefinition,
  isExpression,
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

function completer(input: string): [string[], string] {
  const defs = previousModule.body.filter(isDefinition);
  const completions = defs.map(d => d.variable);
  return [completions, input];
}

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

  if (isDefinition(syntax)) {
    previousModule = removeModuleDefinition(previousModule, syntax.variable);
    previousModule = addToModule(previousModule, syntax);
    m = previousModule;
  } else if (isExpression(syntax)) {
    m = addToModule(previousModule, syntax);
  } else {
    m = previousModule;
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
  const replServer = repl.start({ prompt: "λ ", eval: delispEval, completer });
  replServer.on("exit", () => {
    console.log("\n; bye!");
    process.exit(0);
  });
}

// tslint:enable no-console

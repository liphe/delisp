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

import readline from "readline";

let rl: readline.Interface;
const PROMPT = "λ ";

let previousModule = createModule();
const context = createContext();

export function startREPL() {
  rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    completer,
    prompt: PROMPT
  });
  rl.on("line", handleLine);
  rl.prompt();
}

let inputBuffer = "";
function handleLine(line: string) {
  try {
    inputBuffer += "\n" + line;

    let syntax;
    try {
      syntax = readSyntax(inputBuffer);
    } catch (err) {
      if (err.incomplete) {
        rl.setPrompt("... ");
        rl.prompt();
        return;
      } else {
        inputBuffer = "";
        throw err;
      }
    }

    inputBuffer = "";
    rl.setPrompt(PROMPT);

    const { value, type } = delispEval(syntax);
    console.dir({ value, type }, { depth: null });
  } catch (err) {
    console.error(err);
  } finally {
    rl.prompt();
  }
}

function completer(input: string): [string[], string] {
  const defs = previousModule.body.filter(isDefinition);
  const completions = defs.map(d => d.variable);
  return [completions, input];
}

const delispEval = (syntax: Syntax) => {
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

    return {
      type: type && printType(type)
    };
  } else {
    const type =
      typedSyntax && !isDeclaration(typedSyntax) ? typedSyntax.info.type : null;

    return {
      value,
      type: type && printType(type)
    };
  }
};

// tslint:enable no-console

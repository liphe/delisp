import * as fs from "./fs-helpers";
import path from "path";
import { TaggedValue } from "@delisp/runtime";

import { CommandModule } from "yargs";

import {
  addToModule,
  createContext,
  evaluate,
  evaluateModule,
  inferModule,
  isDeclaration,
  isDefinition,
  isExpression,
  moduleEnvironment,
  printType,
  readModule,
  readSyntax,
  removeModuleDefinition,
  removeModuleTypeDefinition,
  collectConvertErrors
} from "@delisp/core";

import { Typed } from "@delisp/core/src/syntax";
import { Module, Syntax } from "@delisp/core/src/syntax";

import * as theme from "./color-theme";

import readline from "readline";

let rl: readline.Interface;
const PROMPT = "λ ";

let previousModule: Module;
const context = createContext();

async function loadModule(file: string): Promise<Module> {
  const code = await fs.readFile(path.join(file), "utf-8");
  const m = readModule(code);
  inferModule(m);
  evaluateModule(m, context);
  return m;
}

async function startREPL() {
  previousModule = await loadModule(path.join(__dirname, "../../init.dl"));

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
        rl.setPrompt(process.env.INSIDE_EMACS ? "" : "... ");
        rl.prompt();
        return;
      } else {
        inputBuffer = "";
        throw err;
      }
    }

    inputBuffer = "";
    rl.setPrompt(PROMPT);

    const errors = collectConvertErrors(syntax);
    if (errors.length > 0) {
      errors.forEach(err => {
        console.error(theme.error(`ERROR: ${err}\n`));
      });
    }

    const { value, type, name } = delispEval(syntax);
    if (type) {
      const typ = printType(type);
      const sep = typ.length > 10 ? "\n  " : " ";
      console.log(
        dimBrackets(
          `(${theme.dim("the")} ${theme.type(typ)}${sep}${
            name ? theme.name(name) : printColoredValue(value)
          })`
        )
      );
    } else {
      console.log(printColoredValue(value));
    }
  } catch (err) {
    console.error(theme.error(err.message));
  } finally {
    rl.prompt();
  }
}

function completer(input: string): [string[], string] {
  const defs = previousModule.body.filter(isDefinition);
  const completions = defs.map(d => d.node.variable.name);
  return [completions, input];
}

const delispEval = (syntax: Syntax) => {
  //
  // Type checking
  //

  // The current module, extended with the current form
  let m;

  if (isDefinition(syntax)) {
    previousModule = removeModuleDefinition(
      previousModule,
      syntax.node.variable.name
    );
    previousModule = addToModule(previousModule, syntax);
    m = previousModule;
  } else if (syntax.node.tag === "type-alias") {
    previousModule = removeModuleTypeDefinition(
      previousModule,
      syntax.node.alias.name
    );
    previousModule = addToModule(previousModule, syntax);
    m = previousModule;
  } else if (isExpression(syntax)) {
    m = addToModule(previousModule, syntax);
  } else {
    throw new Error(`I don't know how to handle this in the REPL.`);
  }

  let typedModule: Module<Typed> | undefined;
  try {
    const result = inferModule(m);
    typedModule = result.typedModule;
    result.unknowns.forEach(v => {
      console.warn(
        theme.warn(
          `Unknown variable ${v.node.name} expected with type ${printType(
            v.info.type
          )}`
        )
      );
    });
  } catch (err) {
    console.log(theme.error("TYPE WARNING:"));
    console.log(theme.error(err.message));
  }

  const typedSyntax: Syntax<Typed> | null = typedModule
    ? typedModule.body.slice(-1)[0]
    : null;

  //
  // Evaluation
  //

  const env = moduleEnvironment(previousModule, { definitionContainer: "env" });
  const value = evaluate(syntax, env, context);

  if (isDeclaration(syntax)) {
    const type =
      typedSyntax && isDefinition(typedSyntax)
        ? typedSyntax.node.value.info.type
        : null;

    if (isDefinition(syntax)) {
      return { type, name: syntax.node.variable.name };
    } else {
      return { type };
    }
  } else {
    const type =
      typedSyntax && !isDeclaration(typedSyntax) ? typedSyntax.info.type : null;
    return { value, type };
  }
};

function printValue(value: any): string {
  if (typeof value === "number") {
    return `${value}`;
  } else if (typeof value === "boolean") {
    return `${value}`;
  } else if (typeof value === "string") {
    return `"${value}"`;
  } else if (value === undefined || value === null) {
    return "#<undefined>";
  } else if (value instanceof TaggedValue) {
    if (value.value === undefined) {
      return `(case ${value.tag})`;
    } else {
      return `(case ${value.tag} ${value.value})`;
    }
  } else if (Array.isArray(value)) {
    return `[${value.map(printValue).join(" ")}]`;
  } else if (typeof value === "object") {
    return `{${Object.entries(value)
      .map(([k, v]) => `:${k} ${printValue(v)}`)
      .join(" ")}}`;
  } else if (typeof value === "function") {
    return `#<function>`;
  } else {
    return "?";
  }
}

function printColoredValue(value: any): string {
  const printedValue = printValue(value);
  return printedValue[0] === "#" || printedValue[0] === "?"
    ? theme.unreadableValue(printedValue)
    : theme.value(printedValue);
}

function dimBrackets(str: string): string {
  return str
    .split("(")
    .join(theme.dim("("))
    .split(")")
    .join(theme.dim(")"));
}

export const cmdREPL: CommandModule = {
  command: ["repl", "*"],
  describe: "Start a REPL",
  handler: () => {
    startREPL();
  }
};

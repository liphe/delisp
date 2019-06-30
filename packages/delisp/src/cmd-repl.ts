import * as fs from "./fs-helpers";
import path from "path";
import { Pair, TaggedValue } from "@delisp/runtime";

import { CommandModule } from "yargs";

import {
  addToModule,
  createContext,
  evaluate,
  evaluateModule,
  inferModule,
  inferExpressionInModule,
  isDefinition,
  isExpression,
  moduleEnvironment,
  printType,
  readModule,
  readSyntax,
  removeModuleDefinition,
  removeModuleTypeDefinition,
  moduleDefinitionByName,
  collectConvertErrors,
  defaultEnvironment,
  Type
} from "@delisp/core";

import { Typed } from "@delisp/core/src/syntax";
import { Module, Expression, Syntax } from "@delisp/core/src/syntax";

import * as theme from "./color-theme";

import readline from "readline";

let rl: readline.Interface;
const PROMPT = "λ ";

let currentModule: Module;
const context = createContext();

async function compileModule(file: string): Promise<Module> {}

async function loadModule(file: string): Promise<Module> {
  const code = await fs.readFile(path.join(file), "utf-8");
  const m = readModule(code);
  inferModule(m);
  evaluateModule(m, context);
  return m;
}

async function startREPL() {
  currentModule = await loadModule(path.join(__dirname, "../../init.dl"));

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

    const evalResult = delispEval(syntax);
    switch (evalResult.tag) {
      case "expression":
        console.log(
          printWithTheType(evalResult.type, printColoredValue(evalResult.value))
        );
        return;

      case "definition":
        console.log(printWithTheType(evalResult.type, evalResult.name));
        return;

      case "other":
        return;
    }
  } catch (err) {
    console.error(theme.error(err.message + "\n" + err.stack));
  } finally {
    rl.prompt();
  }
}

function completer(input: string): [string[], string] {
  const defs = currentModule.body.filter(isDefinition);
  const completions = defs.map(d => d.node.variable.name);
  return [completions, input];
}

// Update `currentModule` with the syntax as introduced in the REPL.
function updateModule(syntax: Syntax) {
  if (isDefinition(syntax)) {
    currentModule = removeModuleDefinition(
      currentModule,
      syntax.node.variable.name
    );
    currentModule = addToModule(currentModule, syntax);
  } else if (syntax.node.tag === "type-alias") {
    currentModule = removeModuleTypeDefinition(
      currentModule,
      syntax.node.alias.name
    );
    currentModule = addToModule(currentModule, syntax);
  } else if (isExpression(syntax)) {
    // An expression won't affect the module so we don't need to
    // update it.
  } else {
    throw new Error(`I don't know how to handle this in the REPL.`);
  }
}

type DelispEvalResult =
  | {
      tag: "expression";
      type?: Type;
      value: unknown;
    }
  | {
      tag: "definition";
      name: string;
      type?: Type;
    }
  | {
      tag: "other";
    };

const delispEval = (syntax: Syntax): DelispEvalResult => {
  updateModule(syntax);

  //
  // Type checking
  //
  let typedModule: Module<Typed> | undefined;
  let typedExpression: Expression<Typed> | undefined;

  try {
    const result = inferModule(currentModule);
    typedModule = result.typedModule;

    const expressionResult =
      typedModule && isExpression(syntax)
        ? inferExpressionInModule(syntax, typedModule, defaultEnvironment, true)
        : undefined;
    typedExpression = expressionResult && expressionResult.typedExpression;

    [
      ...result.unknowns,
      ...(expressionResult ? expressionResult.unknowns : [])
    ].forEach(v => {
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

  //
  // Evaluation
  //

  const env = moduleEnvironment(currentModule, { definitionContainer: "env" });
  const value = evaluate(syntax, env, context);

  if (isExpression(syntax)) {
    return {
      tag: "expression",
      value,
      type: typedExpression && typedExpression.info.type
    };
  } else if (isDefinition(syntax)) {
    const name = syntax.node.variable.name;
    const definition =
      typedModule && (moduleDefinitionByName(name, typedModule) || undefined);
    const type = definition && definition.node.value.info.type;
    return { tag: "definition", name, type };
  } else {
    return { tag: "other" };
  }
};

function printValue(result: any): string {
  if (typeof result === "number") {
    return `${result}`;
  } else if (typeof result === "boolean") {
    return `${result}`;
  } else if (typeof result === "string") {
    return `"${result}"`;
  } else if (result === undefined) {
    return "none";
  } else if (result === null) {
    return "#<null>";
  } else if (result instanceof TaggedValue) {
    if (result.value === undefined) {
      return `(case ${result.tag})`;
    } else {
      return `(case ${result.tag} ${result.value})`;
    }
  } else if (result instanceof Pair) {
    return `(pair ${printValue(result.fst)} ${printValue(result.snd)})`;
  } else if (Array.isArray(result)) {
    return `[${result.map(printValue).join(" ")}]`;
  } else if (typeof result === "object") {
    return `{${Object.entries(result)
      .map(([k, v]) => `:${k} ${printValue(v)}`)
      .join(" ")}}`;
  } else if (typeof result === "function") {
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

function printWithTheType(type: Type | undefined, x: string): string {
  if (type) {
    // a definition
    const typ = printType(type);
    const sep = typ.length > 10 ? "\n  " : " ";
    return dimBrackets(`(${theme.dim("the")} ${theme.type(typ)}${sep}${x})`);
  } else {
    return x;
  }
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

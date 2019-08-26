import {
  addToModule,
  collectConvertErrors,
  createSandbox,
  decomposeFunctionType,
  defaultEnvironment,
  evaluate,
  evaluateModule,
  ExternalEnvironment,
  inferModule,
  inferSyntaxInModule,
  isDefinition,
  isExpression,
  isFunctionType,
  macroexpandSyntax,
  macroexpandRootExpression,
  mergeExternalEnvironments,
  moduleDefinitionByName,
  moduleEnvironment,
  printType,
  readSyntax,
  removeModuleDefinition,
  removeModuleTypeDefinition,
  resolveModuleDependencies,
  Type,
  wrapInLambda
} from "@delisp/core";
import { Module, Syntax } from "@delisp/core/src/syntax";
import { Pair, TaggedValue } from "@delisp/runtime";
import readline from "readline";
import { CommandModule } from "yargs";
import * as theme from "./color-theme";
import { resolveDependency } from "./compile";
import { getOutputFiles } from "./compile-output";
import { newModule } from "./module";

let rl: readline.Interface;
const PROMPT = "λ ";

let currentModule: Module;
const sandbox = createSandbox(require);

function getOutputFile(name: string): string {
  return getOutputFiles(name).jsFile;
}

async function prepareModule() {
  currentModule = await newModule();
  const { typedModule } = inferModule(currentModule, {
    variables: {},
    types: {}
  });
  evaluateModule(typedModule, sandbox, {
    getOutputFile
  });
}

async function startREPL() {
  await prepareModule();

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
async function handleLine(line: string) {
  try {
    inputBuffer += "\n" + line;

    let syntax;
    try {
      const inputSyntax = readSyntax(inputBuffer);
      const errors = collectConvertErrors(inputSyntax);
      if (errors.length > 0) {
        errors.forEach(err => {
          console.error(theme.error(`ERROR: ${err}\n`));
        });
      }

      const macroexpandedSyntax = macroexpandSyntax(inputSyntax);

      if (isExpression(macroexpandedSyntax)) {
        syntax = macroexpandRootExpression(wrapInLambda(macroexpandedSyntax));
      } else {
        syntax = macroexpandedSyntax;
      }
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

    const evalResult = await delispEval(syntax);
    switch (evalResult.tag) {
      case "expression": {
        const wrappedLambda: any = evalResult.value;
        const value = await wrappedLambda((x: unknown) => x, {});

        if (!isFunctionType(evalResult.type)) {
          throw new Error(
            `I am pretty sure I evaluated a lambda, but the type is not a function type?`
          );
        }
        const { output } = decomposeFunctionType(evalResult.type);
        console.log(printWithTheType(output, printColoredValue(value)));
        return;
      }

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

async function completer(
  input: string,
  callback: (err: null, result: [string[], string]) => void
) {
  const defs = currentModule.body.filter(isDefinition);
  const internalCompletions = defs.map(d => d.node.variable.name);

  const externalEnv = await moduleExternalEnvironment(currentModule);
  const externalCompletions = Object.keys(externalEnv.variables);

  const candidates = [...internalCompletions, ...externalCompletions];

  const completions = candidates.filter(opt => opt.startsWith(input));

  return callback(null, [completions, input]);
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
      type: Type;
      value: unknown;
    }
  | {
      tag: "definition";
      name: string;
      type: Type;
    }
  | {
      tag: "other";
    };

async function moduleExternalEnvironment(
  m: Module
): Promise<ExternalEnvironment> {
  const externalEnvironment = await resolveModuleDependencies(
    m,
    resolveDependency
  );

  const environment = mergeExternalEnvironments(
    defaultEnvironment,
    externalEnvironment
  );

  return environment;
}

const delispEval = async (syntax: Syntax): Promise<DelispEvalResult> => {
  updateModule(syntax);

  //
  // Type checking
  //

  const environment = await moduleExternalEnvironment(currentModule);
  const moduleInference = inferModule(currentModule, environment);
  const syntaxInference = inferSyntaxInModule(
    syntax,
    moduleInference.typedModule,
    environment
  );

  const { typedModule } = moduleInference;
  const { typedSyntax } = syntaxInference;

  const env = moduleEnvironment(currentModule, {
    definitionContainer: "env",
    getOutputFile
  });

  [...moduleInference.unknowns, ...syntaxInference.unknowns].forEach(u => {
    console.warn(
      theme.warn(
        `Unknown variable ${
          u.variable.node.name
        } expected with type ${printType(u.variable.info.resultingType)}`
      )
    );
  });

  //
  // Compilation & Evaluation
  //
  const value = await evaluate(typedSyntax, env, sandbox);

  if (isExpression(typedSyntax)) {
    return {
      tag: "expression",
      value,
      type: typedSyntax && typedSyntax.info.resultingType
    };
  } else if (isDefinition(syntax)) {
    const name = syntax.node.variable.name;
    const definition =
      typedModule && (moduleDefinitionByName(name, typedModule) || undefined);

    if (!definition) {
      throw new Error(`Can't find the definition you just defined?`);
    }
    const type = definition.node.value.info.resultingType;
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

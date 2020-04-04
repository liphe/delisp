import * as Delisp from "@delisp/core";
import { Pair, TaggedValue } from "@delisp/runtime";
import readline from "readline";
import { CommandModule } from "yargs";

import * as theme from "./color-theme";
import { resolveDependency } from "./compile";
import { getOutputFiles } from "./compile-output";
import { newModule } from "./module";

let rl: readline.Interface;
const PROMPT = "λ ";

let currentModule: Delisp.Module;
const sandbox = Delisp.createSandbox(require);

function getOutputFile(name: string): string {
  return getOutputFiles(name).jsFile;
}

async function prepareModule() {
  currentModule = await newModule();
  const { typedModule } = Delisp.inferModule(currentModule, {
    variables: {},
    types: {},
  });
  Delisp.evaluateModule(typedModule, sandbox, {
    getOutputFile,
  });
}

async function startREPL() {
  await prepareModule();

  rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    completer,
    prompt: PROMPT,
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
      const inputSyntax = Delisp.readSyntax(inputBuffer);
      const errors = Delisp.collectConvertErrors(inputSyntax);
      if (errors.length > 0) {
        errors.forEach((err) => {
          console.error(theme.error(`ERROR: ${err}\n`));
        });
      }

      const macroexpandedSyntax = Delisp.macroexpandSyntax(inputSyntax);

      if (Delisp.isExpression(macroexpandedSyntax)) {
        syntax = Delisp.macroexpandRootExpression(
          Delisp.wrapInLambda(macroexpandedSyntax)
        );
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

        if (!Delisp.isFunctionType(evalResult.type)) {
          throw new Error(
            `I am pretty sure I evaluated a lambda, but the type is not a function type?`
          );
        }
        const { output } = Delisp.decomposeFunctionType(evalResult.type);
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
  const defs = currentModule.body.filter(Delisp.isDefinition);
  const internalCompletions = defs.map((d) => d.node.variable.name);

  const externalEnv = await moduleExternalEnvironment(currentModule);
  const externalCompletions = Object.keys(externalEnv.variables);

  const candidates = [...internalCompletions, ...externalCompletions];

  const completions = candidates.filter((opt) => opt.startsWith(input));

  return callback(null, [completions, input]);
}

// Update `currentModule` with the syntax as introduced in the REPL.
function updateModule(syntax: Delisp.Syntax) {
  if (Delisp.isDefinition(syntax)) {
    currentModule = Delisp.removeModuleDefinition(
      currentModule,
      syntax.node.variable.name
    );
    currentModule = Delisp.addToModule(currentModule, syntax);
  } else if (syntax.node.tag === "type-alias") {
    currentModule = Delisp.removeModuleTypeDefinition(
      currentModule,
      syntax.node.alias.name
    );
    currentModule = Delisp.addToModule(currentModule, syntax);
  } else if (Delisp.isExpression(syntax)) {
    // An expression won't affect the module so we don't need to
    // update it.
  } else {
    throw new Error(`I don't know how to handle this in the REPL.`);
  }
}

type DelispEvalResult =
  | {
      tag: "expression";
      type: Delisp.Type;
      value: unknown;
    }
  | {
      tag: "definition";
      name: string;
      type: Delisp.Type;
    }
  | {
      tag: "other";
    };

async function moduleExternalEnvironment(
  m: Delisp.Module
): Promise<Delisp.ExternalEnvironment> {
  const externalEnvironment = await Delisp.resolveModuleDependencies(
    m,
    resolveDependency
  );

  const environment = Delisp.mergeExternalEnvironments(
    Delisp.defaultEnvironment,
    externalEnvironment
  );

  return environment;
}

const delispEval = async (syntax: Delisp.Syntax): Promise<DelispEvalResult> => {
  updateModule(syntax);

  //
  // Type checking
  //

  const environment = await moduleExternalEnvironment(currentModule);
  const moduleInference = Delisp.inferModule(currentModule, environment);
  const syntaxInference = Delisp.inferSyntaxInModule(
    syntax,
    moduleInference.typedModule,
    environment
  );

  const { typedModule } = moduleInference;
  const { typedSyntax } = syntaxInference;

  const env = Delisp.moduleEnvironment(currentModule, {
    definitionContainer: "env",
    getOutputFile,
  });

  [...moduleInference.unknowns, ...syntaxInference.unknowns].forEach((u) => {
    console.warn(
      theme.warn(
        `Unknown variable ${
          u.variable.node.name
        } expected with type ${Delisp.printType(u.variable.info.resultingType)}`
      )
    );
  });

  //
  // Compilation & Evaluation
  //
  const value = await Delisp.evaluate(typedSyntax, env, sandbox);

  if (Delisp.isExpression(typedSyntax)) {
    return {
      tag: "expression",
      value,
      type: typedSyntax && typedSyntax.info.resultingType,
    };
  } else if (Delisp.isDefinition(syntax)) {
    const name = syntax.node.variable.name;
    const definition =
      typedModule &&
      (Delisp.moduleDefinitionByName(name, typedModule) || undefined);

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

function printWithTheType(type: Delisp.Type | undefined, x: string): string {
  if (type) {
    // a definition
    const typ = Delisp.printType(type);
    const sep = typ.length > 10 ? "\n  " : " ";
    return dimBrackets(`(${theme.dim("the")} ${theme.type(typ)}${sep}${x})`);
  } else {
    return x;
  }
}

function dimBrackets(str: string): string {
  return str.split("(").join(theme.dim("(")).split(")").join(theme.dim(")"));
}

export const cmdREPL: CommandModule = {
  command: ["repl", "*"],
  describe: "Start a REPL",
  handler: () => {
    startREPL();
  },
};

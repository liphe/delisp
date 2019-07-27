import {
  addToModule,
  createModule,
  Module,
  readModule,
  readSyntax,
  WithErrors,
  macroexpandModule
} from "@delisp/core";
import { CompileOptions } from "./compile-options";
import { generatePreludeImports } from "./prelude";

async function addPreludetoModule(
  m: Module<WithErrors, WithErrors>
): Promise<Module<WithErrors, WithErrors>> {
  const imports = await generatePreludeImports();
  return imports.reduce((m, i) => addToModule(m, i), m);
}

function addRootContextToModule(
  m: Module<WithErrors, WithErrors>
): Module<WithErrors, WithErrors> {
  return addToModule(m, readSyntax("(define *context* {})"));
}

export async function newModule(): Promise<Module<WithErrors, WithErrors>> {
  let m = createModule<WithErrors, WithErrors>();
  m = await addPreludetoModule(m);
  m = addRootContextToModule(m);
  return m;
}

export async function loadModule(
  content: string,
  options: CompileOptions
): Promise<Module<WithErrors, WithErrors>> {
  let m = readModule(content);

  if (options.includePrelude) {
    m = await addPreludetoModule(m);
  }

  m = addRootContextToModule(m);

  m = macroexpandModule(m);

  return m;
}

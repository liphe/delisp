import {
  addToModule,
  createModule,
  Module,
  readModule,
  readSyntax
} from "@delisp/core";
import { CompileOptions } from "./compile-options";
import { generatePreludeImports } from "./prelude";

async function addPreludetoModule(m: Module): Promise<Module> {
  const imports = await generatePreludeImports();
  return imports.reduce((m, i) => addToModule(m, i), m);
}

function addRootContextToModule(m: Module): Module {
  return addToModule(m, readSyntax("(define *context* {})"));
}

export async function newModule(): Promise<Module> {
  let m = createModule();
  m = await addPreludetoModule(m);
  m = addRootContextToModule(m);
  return m;
}

export async function loadModule(
  content: string,
  options: CompileOptions
): Promise<Module> {
  let m: Module = readModule(content);

  if (options.includePrelude) {
    m = await addPreludetoModule(m);
  }

  m = addRootContextToModule(m);

  return m;
}

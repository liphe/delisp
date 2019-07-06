import { addToModule, createModule, Module, readModule } from "@delisp/core";
import { CompileOptions } from "./compile-options";
import { generatePreludeImports } from "./prelude";

export async function newModule() {
  const imports = await generatePreludeImports();
  return imports.reduce((m, i) => addToModule(m, i), createModule());
}

export async function loadModule(content: string, options: CompileOptions) {
  let m: Module = readModule(content);

  if (options.includePrelude) {
    const imports = await generatePreludeImports();
    m = imports.reduce((m, i) => addToModule(m, i), m);
  }

  return m;
}

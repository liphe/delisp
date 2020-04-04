import * as Delisp from "@delisp/core";
import makeDebug from "debug";
import mkdirp from "mkdirp";
import path from "path";

import { CompileOptions } from "./compile-options";
import { CompileFileResult, getOutputFiles } from "./compile-output";
import * as fs from "./fs-helpers";
import { loadModule } from "./module";
const debug = makeDebug("delisp:cli");

export async function resolveDependency(name: string) {
  const { infoFile } = await getOutputFiles(name);
  const content = await fs.readJSONFile(infoFile);
  return Delisp.decodeExternalEnvironment(content);
}

export async function compileFile(
  file: string,
  options: CompileOptions
): Promise<CompileFileResult> {
  const { jsFile, infoFile, dtsFile } = await getOutputFiles(file);

  debug(`Reading module ${file}`);

  const content = await fs.readFile(file, "utf8");
  const module = await loadModule(content, options);

  // Type check module

  const externalEnvironment = await Delisp.resolveModuleDependencies(
    module,
    resolveDependency
  );

  const environment = Delisp.mergeExternalEnvironments(
    Delisp.defaultEnvironment,
    externalEnvironment
  );

  debug(`Type checking ${file}`);

  const inferResult = Delisp.inferModule(module, environment);
  const typedModule = inferResult.typedModule;

  // Check for unknown references
  if (inferResult.unknowns.length > 0) {
    const unknowns = inferResult.unknowns.map((u) =>
      Delisp.printHighlightedExpr(
        `Unknown variable ${u.variable.node.name} of type ${Delisp.printType(
          u.variable.info.resultingType
        )}`,
        u.variable.location
      )
    );
    throw new Error(unknowns.join("\n\n"));
  }

  await mkdirp(path.dirname(jsFile));

  debug(`Compiling ${file}`);

  const code = Delisp.compileModuleToString(typedModule, {
    esModule: options.moduleFormat === "esm",
    getOutputFile(file: string): string {
      return getOutputFiles(file).jsFile;
    },
  });
  await fs.writeFile(jsFile, code);

  const moduleInt = Delisp.encodeExternalEnvironment(
    Delisp.getModuleExternalEnvironment(typedModule)
  );
  await fs.writeJSONFile(infoFile, moduleInt);

  if (options.tsDeclaration) {
    const content = Delisp.generateTSModuleDeclaration(typedModule);
    await fs.writeFile(dtsFile, content);
  }

  debug(`Compilation of ${file} finished`);

  return { jsFile, infoFile, dtsFile };
}

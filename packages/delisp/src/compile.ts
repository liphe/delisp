import {
  compileModuleToString,
  inferModule,
  printHighlightedExpr,
  printType,
  generateTSModuleDeclaration,
  getModuleExternalEnvironment,
  encodeExternalEnvironment,
  defaultEnvironment,
  resolveModuleDependencies,
  decodeExternalEnvironment,
  mergeExternalEnvironments
} from "@delisp/core";

import * as fs from "./fs-helpers";
import path from "path";
import { promisify } from "util";

import { loadModule } from "./module";
import { CompileOptions } from "./compile-options";

import _mkdirp from "mkdirp";

const mkdirp = promisify(_mkdirp);

interface CompileFileResult {
  jsFile: string;
  infoFile: string;
  dtsFile: string;
}

export async function resolveDependency(name: string) {
  const { infoFile } = await getOutputFiles(name);
  const content = await fs.readJSONFile(infoFile);
  return decodeExternalEnvironment(content);
}

export function getOutputFiles(file: string): CompileFileResult {
  const base = path.dirname(file);
  const OUTPUT_DIR = path.join(base, ".delisp", "build");

  const outFileSansExt = path.join(
    OUTPUT_DIR,
    path.relative(base, path.dirname(file)) +
      path.sep +
      path.basename(file, path.extname(file))
  );
  const jsFile = outFileSansExt + ".js";
  const infoFile = outFileSansExt + ".json";
  const dtsFile = outFileSansExt + ".d.ts";

  return { jsFile, infoFile, dtsFile };
}

export async function compileFile(
  file: string,
  options: CompileOptions
): Promise<CompileFileResult> {
  const { jsFile, infoFile, dtsFile } = await getOutputFiles(file);

  const content = await fs.readFile(file, "utf8");
  const module = await loadModule(content, options);

  // Type check module

  const externalEnvironment = await resolveModuleDependencies(
    module,
    resolveDependency
  );

  const environment = mergeExternalEnvironments(
    defaultEnvironment,
    externalEnvironment
  );

  const inferResult = inferModule(module, environment);
  const typedModule = inferResult.typedModule;

  // Check for unknown references
  if (inferResult.unknowns.length > 0) {
    const unknowns = inferResult.unknowns.map(u =>
      printHighlightedExpr(
        `Unknown variable ${u.node.name} of type ${printType(u.info.type)}`,
        u.location
      )
    );
    throw new Error(unknowns.join("\n\n"));
  }

  await mkdirp(path.dirname(jsFile));

  const code = compileModuleToString(typedModule, {
    esModule: options.moduleFormat === "esm",
    getOutputFile(file: string): string {
      return getOutputFiles(file).jsFile;
    }
  });
  await fs.writeFile(jsFile, code);

  const moduleInt = encodeExternalEnvironment(
    getModuleExternalEnvironment(typedModule)
  );
  await fs.writeJSONFile(infoFile, moduleInt);

  if (options.tsDeclaration) {
    const content = generateTSModuleDeclaration(typedModule);
    await fs.writeFile(dtsFile, content);
  }

  return { jsFile, infoFile, dtsFile };
}

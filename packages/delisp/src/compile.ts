import {
  compileModuleToString,
  inferModule,
  printHighlightedExpr,
  printType,
  readModule,
  generateTSModuleDeclaration,
  getModuleExternalEnvironment,
  encodeExternalEnvironment
} from "@delisp/core";

import * as fs from "./fs-helpers";
import path from "path";
import { promisify } from "util";

import _mkdirp from "mkdirp";

const mkdirp = promisify(_mkdirp);

interface CompileOptions {
  moduleFormat: "cjs" | "esm";
  tsDeclaration: boolean;
}

interface CompileFileResult {
  jsFile: string;
  infoFile: string;
  dtsFile: string;
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
  { moduleFormat, tsDeclaration }: CompileOptions
): Promise<CompileFileResult> {
  const { jsFile, infoFile, dtsFile } = await getOutputFiles(file);

  const content = await fs.readFile(file, "utf8");

  const module = readModule(content);

  // Type check module
  const inferResult = inferModule(module);
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
    esModule: moduleFormat === "esm",
    getOutputFile(file: string): string {
      return getOutputFiles(file).jsFile;
    }
  });
  await fs.writeFile(jsFile, code);

  const moduleInt = encodeExternalEnvironment(
    getModuleExternalEnvironment(typedModule)
  );
  await fs.writeJSONFile(infoFile, moduleInt);

  if (tsDeclaration) {
    const content = generateTSModuleDeclaration(typedModule);
    await fs.writeFile(dtsFile, content);
  }

  return { jsFile, infoFile, dtsFile };
}

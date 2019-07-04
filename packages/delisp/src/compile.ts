import {
  compileModuleToString,
  inferModule,
  printHighlightedExpr,
  printType,
  readModule,
  generateTSModuleDeclaration,
  generateModuleInterface
} from "@delisp/core";

import * as fs from "./fs-helpers";
import path from "path";
import { promisify } from "util";

import _mkdirp from "mkdirp";
import findUp from "find-up";

const mkdirp = promisify(_mkdirp);

async function findProjectDirectory(base: string) {
  const projectDirectory = await findUp(["package.json"], { cwd: base });
  return projectDirectory && path.dirname(projectDirectory);
}

interface CompileOptions {
  moduleFormat: "cjs" | "esm";
  tsDeclaration: boolean;
}

interface CompileFileResult {
  jsFile: string;
  infoFile: string;
}

export async function compileFile(
  file: string,
  { moduleFormat, tsDeclaration }: CompileOptions
): Promise<CompileFileResult> {
  const projectDirectory = await findProjectDirectory(file);
  if (!projectDirectory) {
    throw new Error(`Couldn't find package.json file`);
  }

  const OUTPUT_DIR = path.join(projectDirectory, ".delisp", "build");

  const outFileSansExt = path.join(
    OUTPUT_DIR,
    path.relative(projectDirectory, path.dirname(file)) +
      path.sep +
      path.basename(file, path.extname(file))
  );
  const jsFile = outFileSansExt + ".js";
  const infoFile = outFileSansExt + ".json";

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
    esModule: moduleFormat === "esm"
  });
  await fs.writeFile(jsFile, code);

  const signature = generateModuleInterface(typedModule);
  await fs.writeFile(infoFile, JSON.stringify({ exports: signature }, null, 2));

  if (tsDeclaration) {
    const declarationFile = outFileSansExt + ".d.ts";
    const content = generateTSModuleDeclaration(typedModule);
    await fs.writeFile(declarationFile, content);
  }

  return { jsFile, infoFile };
}

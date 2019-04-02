import { CommandModule } from "yargs";

import {
  compileModuleToString,
  inferModule,
  printHighlightedExpr,
  printType,
  readModule,
  generateTSModuleDeclaration
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

async function compileFile(
  file: string,
  { moduleFormat, tsDeclaration }: CompileOptions
): Promise<void> {
  const cwd = process.cwd();
  const OUTPUT_DIR = path.join(cwd, ".delisp", "build");
  const basename = path.basename(file, path.extname(file));
  const outfile = path.resolve(
    OUTPUT_DIR,
    path.relative(cwd, basename + ".js")
  );

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

  const code = compileModuleToString(module, {
    esModule: moduleFormat === "esm"
  });

  await mkdirp(path.dirname(outfile));
  await fs.writeFile(outfile, code);

  if (tsDeclaration) {
    const declarationFile = path.resolve(
      OUTPUT_DIR,
      path.relative(cwd, basename + ".d.ts")
    );
    const content = generateTSModuleDeclaration(typedModule);
    await fs.writeFile(declarationFile, content);
  }

  return;
}

export const cmdCompile: CommandModule = {
  command: "compile [files...]",
  describe: "Compile delisp files",
  builder: yargs =>
    yargs
      .option("module", {
        choices: ["cjs", "esm"],
        default: "cjs",
        describe: "Module format to use"
      })
      .option("ts-declaration", {
        type: "boolean",
        describe: "Generate Typescript declaration file"
      }),

  handler: args => {
    const files = args.files as string[];
    Promise.all(
      files.map(file =>
        compileFile(file, {
          moduleFormat: args.module as "cjs" | "esm",
          tsDeclaration: args["ts-declaration"] ? true : false
        })
      )
    ).catch(err => {
      // eslint:disable: no-console
      console.log(err.message);
      process.exit(-1);
    });
  }
};

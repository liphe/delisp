import { CommandModule } from "yargs";

import {
  compileModuleToString,
  inferModule,
  printHighlightedExpr,
  printType,
  readModule
} from "@delisp/core";

import { promises as fs } from "fs";
import path from "path";
import { promisify } from "util";

import _mkdirp from "mkdirp";

const mkdirp = promisify(_mkdirp);

async function compileFile(
  file: string,
  moduleFormat: "cjs" | "esm"
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

  // Check for unknown references
  if (inferResult.unknowns.length > 0) {
    const unknowns = inferResult.unknowns.map(u =>
      printHighlightedExpr(
        `Unknown variable ${u.name} of type ${printType(u.info.type)}`,
        u.location
      )
    );
    throw new Error(unknowns.join("\n\n"));
  }

  const code = compileModuleToString(module, undefined, moduleFormat === "esm");

  await mkdirp(path.dirname(outfile));
  await fs.writeFile(outfile, code);
  return;
}

export const cmdCompile: CommandModule = {
  command: "compile [files...]",
  describe: "Compile delisp files",
  builder: yargs =>
    yargs.option("module", {
      choices: ["cjs", "esm"],
      default: "cjs",
      describe: "Module format to use"
    }),
  handler: args => {
    const files = args.files as string[];
    Promise.all(
      files.map(file => compileFile(file, args.module as "cjs" | "esm"))
    ).catch(err => {
      // tslint:disable: no-console
      console.log(err.message);
      process.exit(-1);
    });
  }
};

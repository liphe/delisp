import {
  compileModuleToString,
  inferModule,
  pprintModule,
  printHighlightedExpr,
  printType,
  readModule
} from "@delisp/core";
import { promises as fs } from "fs";
import _mkdirp from "mkdirp";
import path from "path";
import { promisify } from "util";
import { startREPL } from "./repl";

const mkdirp = promisify(_mkdirp);

export async function formatFile(file: string): Promise<void> {
  const content = await fs.readFile(file, "utf8");
  const m = readModule(content);
  // TODO: Customize lineWidth?
  const formatted = pprintModule(m, 80);
  await fs.writeFile(file, formatted);
}

export async function compileFile(file: string): Promise<void> {
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

  const code = compileModuleToString(module);

  await mkdirp(path.dirname(outfile));
  await fs.writeFile(outfile, code);
  return;
}

export async function describeFile(file: string): Promise<void> {
  const content = await fs.readFile(file, "utf8");
  const m = readModule(content);
  const inferResult = inferModule(m);

  const infos = inferResult.typedModule.body
    .map(s => {
      if (s.type === "export") {
        return `🔸 ${s.name} :: ${printType(s.value.info.type)}`;
      } else if (s.type === "definition") {
        return `🔹 ${s.variable} :: ${printType(s.value.info.type)}`;
      } else {
        return null;
      }
    })
    .filter(Boolean);

  /* tslint:disable:no-console */
  console.log(infos.join("\n"));
  /* tslint:enable:no-console */
}

async function processArgs(args: string[]): Promise<void> {
  if (args.length < 1) {
    startREPL();
  } else {
    const [cmd, ...cmdArgs] = args;
    switch (cmd) {
      case "compile": {
        const files = cmdArgs;
        await Promise.all(files.map(compileFile));
        return;
      }

      case "format": {
        const files = cmdArgs;
        await Promise.all(files.map(formatFile));
        return;
      }

      case "describe": {
        const files = cmdArgs;
        await Promise.all(files.map(describeFile));
        return;
      }

      default:
        throw new Error(`Unknown command ${cmd}`);
    }
  }
}

processArgs(process.argv.slice(2)).catch(err => {
  /* tslint:disable:no-console */
  console.error(err);
  /* tslint:enable:no-console */
  process.exit(-1);
});

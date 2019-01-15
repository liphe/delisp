import { compileModuleToString, inferModule, readModule } from "@delisp/core";
import { promises as fs } from "fs";
import _mkdirp from "mkdirp";
import path from "path";
import { promisify } from "util";
import { startREPL } from "./repl";

const mkdirp = promisify(_mkdirp);

const files = process.argv.slice(2);

async function compileFile(file: string): Promise<void> {
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
  inferModule(module);

  const code = compileModuleToString(module);

  await mkdirp(path.dirname(outfile));
  await fs.writeFile(outfile, code);
  return;
}

if (files.length === 0) {
  startREPL();
} else {
  Promise.all(files.map(compileFile)).catch(err => {
    /* tslint:disable:no-console */
    console.error(err);
    /* tslint:enable:no-console */
    process.exit(-1);
  });
}

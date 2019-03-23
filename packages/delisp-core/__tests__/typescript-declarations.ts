import mkdirp from "mkdirp";

import childProcess from "child_process";
import path from "path";
import fs from "fs";
import { promisify } from "util";

import { readModule } from "../src/module";
import { compileModuleToString } from "../src/compiler";
import { inferModule } from "../src/infer";
import { generateTSModuleDeclaration } from "../src/typescript-generation";

const exec = promisify(childProcess.exec);
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

// Compile a TS file.
async function tsc(file: string) {
  try {
    return exec(`npx tsc "${file}"`);
  } catch (err) {
    throw new Error(err.stdout);
  }
}

async function buildModule(file: string): Promise<void> {
  const m = readModule(await readFile(file, "utf8"));
  const { typedModule } = inferModule(m);

  const jscode = compileModuleToString(m);
  await writeFile(file.replace(/\.dl$/, ".js"), jscode);

  const tsdecl = generateTSModuleDeclaration(typedModule);
  await writeFile(file.replace(/\.dl$/, ".d.ts"), tsdecl);
}

const FIXTURE_DIR = path.resolve(__dirname, "typescript-declaration-fixtures");
mkdirp.sync(FIXTURE_DIR);

describe("Typescript declarations", () => {
  it("can be used by typescript", async () => {
    await buildModule(path.join(FIXTURE_DIR, "example.dl"));
    const tsfile = path.join(FIXTURE_DIR, "test.ts");
    await tsc(tsfile);
    await exec(`node "${tsfile.replace(/\.ts$/, ".js")}"`);
  });
});

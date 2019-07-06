import childProcess from "child_process";
import fs from "fs";
import mkdirp from "mkdirp";
import path from "path";
import { promisify } from "util";
import { compileModuleToString } from "../src/compiler";
import { inferModule } from "../src/infer";
import { readModule } from "../src/module";
import { generateTSModuleDeclaration } from "../src/typescript-generation";

const exec = promisify(childProcess.exec);
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

// Compile a TS file.
async function tsc(file: string) {
  try {
    return exec(
      `${path.join(__dirname, "../../../")}/node_modules/.bin/tsc "${file}"`
    );
  } catch (err) {
    throw new Error(err.stdout);
  }
}

async function buildModule(file: string): Promise<void> {
  const m = readModule(await readFile(file, "utf8"));
  const { typedModule } = inferModule(m);

  const jscode = compileModuleToString(m, {
    getOutputFile: name => name
  });
  await writeFile(file.replace(/\.dl$/, ".js"), jscode);

  const tsdecl = generateTSModuleDeclaration(typedModule);
  await writeFile(file.replace(/\.dl$/, ".d.ts"), tsdecl);
}

const FIXTURE_DIR = path.resolve(__dirname, "typescript-declaration-fixtures");
mkdirp.sync(FIXTURE_DIR);

describe("Typescript declarations", () => {
  // This test is not working currently because type schemas contain
  // variables of kind effects which can't be encoded in Typescript
  // and should be removed. However, we don't do kind inference.
  it.skip("can be used by typescript", async () => {
    await buildModule(path.join(FIXTURE_DIR, "example.dl"));
    const tsfile = path.join(FIXTURE_DIR, "test.ts");
    await tsc(tsfile);
    await exec(`node "${tsfile.replace(/\.ts$/, ".js")}"`);
  });
});

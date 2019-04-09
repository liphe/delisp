import { CommandModule } from "yargs";

import * as fs from "./fs-helpers";

import { lintModule, readModule } from "@delisp/core";

async function lintFile(file: string): Promise<void> {
  const content = await fs.readFile(file, "utf8");
  const m = readModule(content);
  lintModule(m);
}

export const cmdLint: CommandModule = {
  command: "lint [files...]",
  describe: "Lint delisp files",
  handler: args => {
    const files = args.files as string[];
    Promise.all(files.map(lintFile)).catch(err => {
      console.log(err.message);
      process.exit(-1);
    });
  }
};

import { collectConvertErrors, readModule } from "@delisp/core";
import createDebug from "debug";
import { CommandModule } from "yargs";

import * as fs from "./fs-helpers";

const debug = createDebug(`delisp:cli:lint`);

async function lintFile(file: string): Promise<string[]> {
  const content = await fs.readFile(file, "utf8");
  const m = readModule(content);
  return m.body.reduce((errors: string[], f) => {
    return [...errors, ...collectConvertErrors(f)];
  }, []);
}

export const cmdLint: CommandModule = {
  command: "lint [files...]",
  describe: "Lint delisp files",
  handler: async (args) => {
    const files = args.files as string[];
    let errored = false;

    try {
      console.log(`linting ${files}`);
      await Promise.all(
        files.map(async (file) => {
          debug(`Linting ${file}`);
          const errors = await lintFile(file);
          errors.forEach((err) => {
            console.error(err);
            console.error();
          });
          if (errors.length > 0) {
            errored = true;
          }
        })
      );
    } catch (err) {
      console.error(err);
      process.exit(-1);
    }

    process.exit(errored ? -1 : 0);
  },
};

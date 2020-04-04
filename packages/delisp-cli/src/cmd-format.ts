import { pprintModule, readModule } from "@delisp/core";
import { CommandModule } from "yargs";

import * as fs from "./fs-helpers";

async function formatFile(file: string): Promise<void> {
  const content = await fs.readFile(file, "utf8");
  const m = readModule(content);
  // TODO: Customize lineWidth?
  const formatted = pprintModule(m, 40);
  await fs.writeFile(file, formatted);
}

export const cmdFormat: CommandModule = {
  command: "format [files...]",
  describe: "Format delisp files",
  handler: (args) => {
    const files = args.files as string[];
    Promise.all(files.map(formatFile)).catch((err) => {
      console.error(err.message);
      console.error(err.stack);
      process.exit(-1);
    });
  },
};

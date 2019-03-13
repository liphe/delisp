import { promises as fs } from "fs";

import { pprintModule, readModule } from "@delisp/core";

async function formatFile(file: string): Promise<void> {
  const content = await fs.readFile(file, "utf8");
  const m = readModule(content);
  // TODO: Customize lineWidth?
  const formatted = pprintModule(m, 40);
  await fs.writeFile(file, formatted);
}

export async function cmdFormat(args: string[]) {
  await Promise.all(args.map(formatFile));
}

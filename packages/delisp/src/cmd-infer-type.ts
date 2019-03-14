import { CommandModule } from "yargs";

import {
  findSyntaxByOffset,
  inferModule,
  isExpression,
  printType,
  readModule
} from "@delisp/core";

import { promises as fs } from "fs";

// tslint:disable no-console

function wrap<A>(fn: (args: A) => Promise<unknown>): (args: A) => void {
  return async (...args) => {
    try {
      fn.apply(null, args);
    } catch (err) {
      console.error(err.message);
      process.exit(-1);
      return;
    }
  };
}

export const cmdInferType: CommandModule = {
  command: "infer-type <file>",
  builder: yargs => {
    return yargs
      .number("cursor-offset")
      .demand(
        "cursor-offset",
        "You must specify the cursor offset to identiy which expression you want to infer."
      );
  },
  handler: wrap(async args => {
    const file = args.file as string;
    const cursorOffset = args.cursorOffset as number;

    const content = await fs.readFile(file, "utf8");

    if (!(0 <= cursorOffset && cursorOffset <= content.length)) {
      console.error("Cursor is out of range");
      process.exit(-1);
    }

    const rawModule = readModule(content);
    const { typedModule } = inferModule(rawModule);

    const s = findSyntaxByOffset(typedModule, cursorOffset);

    if (s && isExpression(s)) {
      console.log(printType(s.info.type));
    }

    process.exit(0);
  })
};

import { CommandModule } from "yargs";

import {
  findSyntaxByOffset,
  inferModule,
  isDefinition,
  isExport,
  isExpression,
  isTypeAlias,
  printType,
  readModule
} from "@delisp/core";

import * as fs from "./fs-helpers";

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

    if (s) {
      if (isExpression(s)) {
        console.log(printType(s.info.type));
      } else if (isTypeAlias(s)) {
        console.log(s);
      } else if (isDefinition(s)) {
        console.log(printType(s.value.info.type));
      } else if (isExport(s)) {
        console.log(printType(s.value.info.type));
      }
    }

    process.exit(0);
  })
};

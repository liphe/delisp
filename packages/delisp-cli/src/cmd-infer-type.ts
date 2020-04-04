import {
  findSyntaxByOffset,
  inferModule,
  isDefinition,
  isExport,
  isExpression,
  isTypeAlias,
  printType,
  readModule,
} from "@delisp/core";
import { CommandModule } from "yargs";

import * as fs from "./fs-helpers";

function wrap<A>(fn: (args: A) => Promise<unknown>): (args: A) => void {
  return async (...args) => {
    try {
      fn(...args);
    } catch (err) {
      console.error(err.message);
      process.exit(-1);
      return;
    }
  };
}

export const cmdInferType: CommandModule = {
  command: "infer-type <file>",
  builder: (yargs) => {
    return yargs
      .option("cursor-offset", {
        type: "number",
      })
      .demand(
        "cursor-offset",
        "You must specify the cursor offset to identiy which expression you want to infer."
      );
  },
  handler: wrap(async (args) => {
    const file = args.file as string;
    const cursorOffset = args["cursor-offset"] as number;

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
        console.log(printType(s.info.resultingType));
      } else if (isTypeAlias(s)) {
        console.log(s);
      } else if (isDefinition(s)) {
        console.log(printType(s.node.value.info.resultingType));
      } else if (isExport(s)) {
        console.log();
      }
    }

    process.exit(0);
  }),
};

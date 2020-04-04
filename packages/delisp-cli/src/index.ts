import yargs from "yargs";

import { cmdCompile } from "./cmd-compile";
import { cmdFormat } from "./cmd-format";
import { cmdInferType } from "./cmd-infer-type";
import { cmdLint } from "./cmd-lint";
import { cmdREPL } from "./cmd-repl";

require("source-map-support").install();

yargs
  .usage("usage: $0 <command>")
  .option("color", {
    // We don't do anything with this flag, but we avoid the warning
    // of unkonwn option and chalk will interpret it.
    type: "boolean",
  })
  .command(cmdREPL)
  .command(cmdFormat)
  .command(cmdLint)
  .command(cmdCompile)
  // Commands for editor integration
  .command(cmdInferType)
  .parserConfiguration({ "camel-case-expansion": false })
  .strict()
  .help("help").argv;

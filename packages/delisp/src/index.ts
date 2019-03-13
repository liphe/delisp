import { cmdCompile } from "./cmd-compile";
import { cmdFormat } from "./cmd-format";
import { cmdREPL } from "./cmd-repl";

async function processArgs(args: string[]): Promise<void> {
  if (args.length < 1) {
    cmdREPL(args);
  } else {
    const [cmd, ...cmdArgs] = args;
    switch (cmd) {
      case "compile":
        return cmdCompile(cmdArgs);
      case "format":
        return cmdFormat(cmdArgs);
      default:
        throw new Error(`Unknown command ${cmd}`);
    }
  }
}

processArgs(process.argv.slice(2)).catch(err => {
  /* tslint:disable:no-console */
  console.error(err.message);
  /* tslint:enable:no-console */
  process.exit(-1);
});

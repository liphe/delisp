import { CommandModule } from "yargs";
import { compileFile } from "./compile";

export const cmdCompile: CommandModule = {
  command: "compile [files...]",
  describe: "Compile delisp files",
  builder: yargs =>
    yargs
      .option("module", {
        choices: ["cjs", "esm"],
        default: "cjs",
        describe: "Module format to use"
      })
      .option("ts-declaration", {
        type: "boolean",
        describe: "Generate Typescript declaration file"
      }),

  handler: async args => {
    const files = args.files as string[];

    Promise.all(
      files.map(file =>
        compileFile(file, {
          moduleFormat: args.module as "cjs" | "esm",
          tsDeclaration: args["ts-declaration"] ? true : false
        })
      )
    ).catch(err => {
      // eslint:disable: no-console
      console.error(err.message);
      process.exit(-1);
    });
  }
};

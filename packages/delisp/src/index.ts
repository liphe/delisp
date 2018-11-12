import readline from "readline";

import { readFromString } from "@delisp/core";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "λ "
});

rl.prompt();

rl.on("line", line => {
  const syntax = readFromString(line);
  console.log(syntax);
  rl.prompt();
}).on("close", () => {
  console.log("\n; bye!");
  process.exit(0);
});

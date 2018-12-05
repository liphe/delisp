import { convert } from "./convert";
import { readFromString } from "./reader";
import { Syntax } from "./syntax";

export { compileToString } from "./compiler";
export { evaluate } from "./eval";
export { inferType } from "./infer";
// TODO: replace with the pretty printer
export { printType } from "./type-utils";
export { isDeclaration } from "./syntax";

export function readSyntax(source: string): Syntax {
  return convert(readFromString(source));
}

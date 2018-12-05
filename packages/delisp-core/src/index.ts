import { convert as convertSyntax } from "./convert";
import { convert as convertType } from "./convertType";
import { readFromString } from "./reader";
import { Syntax } from "./syntax";
import { Type } from "./types";

export { compileToString } from "./compiler";
export { evaluate } from "./eval";
export { inferType } from "./infer";
// TODO: replace with the pretty printer
export { printType } from "./type-utils";
export { isDeclaration } from "./syntax";

export function readSyntax(source: string): Syntax {
  return convertSyntax(readFromString(source));
}

export function readType(source: string): Type {
  return convertType(readFromString(source));
}

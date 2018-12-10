import { convert as convertSyntax } from "./convert";
import { convert as convertType } from "./convertType";
import { readAllFromString, readFromString } from "./reader";
import { Module, Syntax } from "./syntax";
import { Monotype } from "./types";

export { compileToString } from "./compiler";
export { evaluate } from "./eval";
export { inferType } from "./infer";
// TODO: replace with the pretty printer
export { printType } from "./type-utils";
export { isDeclaration } from "./syntax";

export function readSyntax(source: string): Syntax {
  return convertSyntax(readFromString(source));
}

export function readModule(str: string): Module {
  return {
    type: "module",
    body: readAllFromString(str).map(convertSyntax)
  };
}

export function readType(source: string): Monotype {
  return convertType(readFromString(source));
}

import { convert as convertSyntax } from "./convert";

import { readAllFromString, readFromString } from "./reader";
import { Module, Syntax } from "./syntax";

export { compileToString, compileModuleToString } from "./compiler";
export { evaluate, createContext } from "./eval";
export { inferType } from "./infer";
// TODO: replace with the pretty printer
export { printType } from "./type-utils";
export { isDeclaration } from "./syntax";

export { default as primitives } from "./primitives";

export function readSyntax(source: string): Syntax {
  return convertSyntax(readFromString(source));
}

export function readModule(str: string): Module {
  return {
    type: "module",
    body: readAllFromString(str).map(convertSyntax)
  };
}

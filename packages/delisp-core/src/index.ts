import { convert as convertSyntax } from "./convert";

import { readFromString } from "./reader";
import { Syntax } from "./syntax";

export {
  compileToString,
  compileModuleToString,
  moduleEnvironment
} from "./compiler";
export { createContext, evaluate, evaluateModule } from "./eval";
export { inferType, inferModule } from "./infer";
// TODO: replace with the pretty printer
export { printType } from "./type-utils";
export { isDeclaration, isDefinition, isExpression } from "./syntax";
export { pprintModule } from "./printer";

export { default as primitives } from "./primitives";

export { printHighlightedExpr } from "./error-report";

export function readSyntax(source: string): Syntax {
  return convertSyntax(readFromString(source));
}

export { findSyntaxByOffset } from "./syntax-utils";

export * from "./module";

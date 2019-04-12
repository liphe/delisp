import { convert as convertSyntax } from "./convert";

import { readFromString } from "./reader";
import { Syntax } from "./syntax";

export { collectConvertErrors } from "./convert";

export {
  compileToString,
  compileModuleToString,
  moduleEnvironment
} from "./compiler";
export { createContext, evaluate, evaluateModule } from "./eval";
export { inferType, inferModule } from "./infer";
export { printType } from "./type-printer";
export {
  isDeclaration,
  isDefinition,
  isExpression,
  isExport,
  isTypeAlias
} from "./syntax";
export { pprintModule } from "./printer";

export { default as primitives } from "./primitives";

export { printHighlightedExpr } from "./error-report";

export function readSyntax(source: string): Syntax {
  return convertSyntax(readFromString(source));
}

export { findSyntaxByOffset, findSyntaxByRange } from "./syntax-utils";

export {
  createModule,
  readModule,
  addToModule,
  removeModuleDefinition,
  removeModuleTypeDefinition
} from "./module";

export { generateTSModuleDeclaration } from "./typescript-generation";

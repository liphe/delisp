import { convert as convertSyntax } from "./convert";

import { readFromString } from "./reader";

export { collectConvertErrors } from "./convert";

export {
  compileToString,
  compileModuleToString,
  moduleEnvironment
} from "./compiler";
export { createContext, evaluate, evaluateModule } from "./eval";
export {
  inferType,
  inferModule,
  inferExpressionInModule,
  defaultEnvironment
} from "./infer";
export { Type } from "./types";
export { printType } from "./type-printer";
export {
  isDeclaration,
  isDefinition,
  isExpression,
  isExport,
  isTypeAlias
} from "./syntax";
export { default as primitives } from "./primitives";

export { printHighlightedExpr } from "./error-report";

export function readSyntax(source: string) {
  return convertSyntax(readFromString(source));
}

export { findSyntaxByOffset, findSyntaxByRange } from "./syntax-utils";

export {
  createModule,
  readModule,
  addToModule,
  removeModuleDefinition,
  removeModuleTypeDefinition,
  moduleDefinitions,
  moduleDefinitionByName
} from "./module";

export { generateTSModuleDeclaration } from "./typescript-generation";

export { Encoder } from "./prettier";
export { pprintAs, pprint, pprintModuleAs, pprintModule } from "./printer";

import { convert as convertSyntax } from "./convert";

import { readFromString } from "./reader";

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
  isTypeAlias,
  Module,
  Declaration,
  Expression,
  Syntax,
  Typed
} from "./syntax";
export { default as primitives } from "./primitives";

export { printHighlightedExpr } from "./error-report";

export function readSyntax(source: string) {
  return convertSyntax(readFromString(source));
}

export {
  exprFChildren,
  findSyntaxByOffset,
  findSyntaxByRange
} from "./syntax-utils";

export {
  createModule,
  readModule,
  addToModule,
  removeModuleDefinition,
  removeModuleTypeDefinition
} from "./module";

export { generateTSModuleDeclaration } from "./typescript-generation";

export { Encoder } from "./prettier";
export { pprintAs, pprint, pprintModuleAs, pprintModule } from "./printer";

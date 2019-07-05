export { collectConvertErrors, readSyntax } from "./convert";

export {
  compileToString,
  compileModuleToString,
  moduleEnvironment
} from "./compiler";
export { createContext, evaluate, evaluateModule, evaluateJS } from "./eval";
export {
  inferType,
  inferModule,
  inferExpressionInModule,
  defaultEnvironment,
  getModuleExternalEnvironment
} from "./infer";
export {
  ExternalEnvironment,
  encodeExternalEnvironment,
  decodeExternalEnvironment,
  mergeExternalEnvironments
} from "./infer-environment";
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

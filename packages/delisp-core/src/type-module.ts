import { Module, Typed } from "./syntax";
import { readType } from "./convert-type";
import { printType } from "./type-printer";
import { moduleDefinitions } from "./module";
import { fromEntries, mapObject } from "./utils";
import { ExternalEnvironment } from "./infer-environment";

// TODO: Use ts-io to create proper types
export function parseModuleInterface(moduleInt: any): ExternalEnvironment {
  return {
    variables: mapObject(moduleInt.variables, t => readType(t as string)),
    types: {}
  };
}

export function generateModuleInterface(m: Module<Typed>) {
  return {
    variables: fromEntries(
      moduleDefinitions(m).map(def => {
        const { variable, value } = def.node;
        const name = variable.name;
        const typ = printType(value.info.resultingType, true);
        return [name, typ];
      })
    ),
    types: {}
  };
}

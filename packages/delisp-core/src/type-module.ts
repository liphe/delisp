import { Module, Typed } from "./syntax";
import { printType } from "./type-printer";
import { moduleDefinitions } from "./module";
import { fromEntries } from "./utils";

export function generateModuleInterface(m: Module<Typed>) {
  return fromEntries(
    moduleDefinitions(m).map(def => {
      const { variable, value } = def.node;
      const name = variable.name;
      const typ = printType(value.info.resultingType, true);
      return [name, typ];
    })
  );
}

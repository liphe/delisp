import { convert, WithErrors } from "./syntax-convert";
import { readAllFromString } from "./reader";
import {
  isDefinition,
  isExport,
  isImport,
  isTypeAlias,
  Module,
  SDefinition,
  SExport,
  SImport,
  Syntax
} from "./syntax";
import { flatMap } from "./utils";

export function createModule(): Module {
  return {
    tag: "module",
    body: []
  };
}

export function readModule(str: string): Module<WithErrors, WithErrors> {
  return {
    tag: "module",
    body: readAllFromString(str).map(convert)
  };
}

export function addToModule<EInfo, SInfo>(
  m: Module<EInfo, SInfo>,
  s: Syntax<EInfo, SInfo>
): Module<EInfo, SInfo> {
  return {
    tag: "module",
    body: [...m.body, s]
  };
}

export function removeModuleDefinition(m: Module, name: string): Module {
  return {
    tag: "module",
    body: m.body.filter(d => {
      return isDefinition(d) ? d.node.variable.name !== name : true;
    })
  };
}

export function removeModuleTypeDefinition(m: Module, name: string): Module {
  return {
    tag: "module",
    body: m.body.filter(d => {
      return isTypeAlias(d) ? d.node.alias.name !== name : true;
    })
  };
}

export function moduleExportedDefinitions<A>(
  m: Module<A>
): Array<SDefinition<A>> {
  const exported = flatMap(e => e.node.identifiers, moduleExports(m)).map(
    i => i.name
  );
  return moduleDefinitions(m).filter(d =>
    exported.includes(d.node.variable.name)
  );
}

export function moduleDefinitions<A>(m: Module<A>): Array<SDefinition<A>> {
  return m.body.filter(isDefinition);
}

export function moduleExports<A>(m: Module<A>): Array<SExport<A>> {
  return m.body.filter(isExport);
}

export function moduleImports<A>(m: Module<A>): Array<SImport<A>> {
  return m.body.filter(isImport);
}

export function moduleDefinitionByName<A>(
  name: string,
  m: Module<A>
): SDefinition<A> | null {
  return (
    moduleDefinitions(m).find(def => def.node.variable.name === name) || null
  );
}

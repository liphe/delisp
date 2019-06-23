import { WithErrors, convert } from "./convert";
import { readAllFromString } from "./reader";
import { Module, Syntax, SDefinition, isDefinition } from "./syntax";

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

export function addToModule(m: Module, s: Syntax): Module {
  return {
    tag: "module",
    body: [...m.body, s]
  };
}

export function removeModuleDefinition(m: Module, name: string): Module {
  return {
    tag: "module",
    body: m.body.filter(d => {
      return d.node.tag === "definition" ? d.node.variable.name !== name : true;
    })
  };
}

export function removeModuleTypeDefinition(m: Module, name: string): Module {
  return {
    tag: "module",
    body: m.body.filter(d => {
      return d.node.tag === "type-alias" ? d.node.alias.name !== name : true;
    })
  };
}

export function moduleDefinitions<A>(m: Module<A>): Array<SDefinition<A>> {
  return m.body.filter(isDefinition);
}

export function moduleDefinitionByName<A>(
  name: string,
  m: Module<A>
): SDefinition<A> | null {
  return (
    moduleDefinitions(m).find(def => def.node.variable.name === name) || null
  );
}

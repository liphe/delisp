import { convert } from "./convert";
import { readAllFromString } from "./reader";
import { Module, Syntax } from "./syntax";

export function createModule(): Module {
  return {
    tag: "module",
    body: []
  };
}

export function readModule(str: string): Module {
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

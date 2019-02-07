import { convert } from "./convert";
import { readAllFromString } from "./reader";
import { isDeclaration, Module, Syntax } from "./syntax";

export function createModule(): Module {
  return {
    type: "module",
    body: []
  };
}

export function readModule(str: string): Module {
  return {
    type: "module",
    body: readAllFromString(str).map(convert)
  };
}

export function addToModule(m: Module, s: Syntax): Module {
  return {
    type: "module",
    body: [...m.body, s]
  };
}

export function removeModuleDefinition(m: Module, name: string): Module {
  return {
    type: "module",
    body: m.body.filter(d => {
      return isDeclaration(d) ? d.variable !== name : true;
    })
  };
}
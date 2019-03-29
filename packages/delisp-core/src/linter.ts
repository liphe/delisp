import { Module, SDefinition } from "./syntax";
import { traverseModule } from "./syntax-utils";

function noUnusedVars(m: Module): void {
  const variables: Map<string, SDefinition> = new Map();

  traverseModule(m, s => {
    if (s.tag === "definition") {
      variables.set(s.variable.name, s);
    }
    if (s.tag === "identifier") {
      variables.delete(s.name);
    }
  });

  variables.forEach((def, name) => {
    console.warn(
      `[file:${
        def.location.start
      }] WARNING "${name}" is defined but never used (no-unused-vars)`
    );
  });
}

export function lintModule(m: Module) {
  noUnusedVars(m);
}

import { Module, SDefinition } from "./syntax";
import { traverseModule } from "./syntax-utils";
import { printHighlightedExpr } from "./error-report";

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
      printHighlightedExpr(
        `"${name}" is defined but never used (no-unused-vars)`,
        def.location
      )
    );
  });
}

export function lintModule(m: Module) {
  noUnusedVars(m);
}

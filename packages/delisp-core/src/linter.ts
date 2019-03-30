import { Module, SIdentifier } from "./syntax";
import { traverseModule } from "./syntax-utils";
import { printHighlightedExpr } from "./error-report";

function noUnusedVars(m: Module): void {
  const variables: Map<symbol, SIdentifier> = new Map();

  traverseModule(m, (s, refs) => {
    if (s.tag === "definition") {
      if (refs.has(s.variable.name)) {
        variables.set(refs.get(s.variable.name)!, s.variable);
      }
    }
    if (s.tag === "identifier") {
      if (refs.has(s.name)) {
        variables.delete(refs.get(s.name)!);
      }
    }
  });

  variables.forEach(v => {
    console.warn(
      printHighlightedExpr(
        `"${v.name}" is defined but never used (no-unused-vars)`,
        v.location
      )
    );
  });
}

function noEmptyLet(m: Module): void {
  traverseModule(m, s => {
    if (s.tag === "let-bindings") {
      if (s.bindings.length === 0) {
        console.warn(
          printHighlightedExpr(
            `no variables bound in let expression (no-empty-let)`,
            s.location
          )
        );
      }
    }
  });
}

export function lintModule(m: Module) {
  noUnusedVars(m);
  noEmptyLet(m);
}

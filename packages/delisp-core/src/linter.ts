import { Identifier, Module } from "./syntax";
import { isModule, traverseModule } from "./syntax-utils";
import { printHighlightedExpr } from "./error-report";

function noUnusedVars(m: Module): void {
  const used: Set<Identifier> = new Set();

  traverseModule(
    m,
    (current, scope) => {
      if (isModule(current)) {
        return;
      } else if (current.node.tag === "variable-reference") {
        const binding = scope[current.node.name];
        if (binding) {
          used.add(binding.identifier);
        }
      } else if (current.node.tag === "export") {
        const binding = scope[current.node.value.name];
        if (binding) {
          used.add(binding.identifier);
        }
      }
    },
    (current, scope) => {
      Object.entries(scope)
        .filter(([_, binding]) => !used.has(binding.identifier))
        .filter(([_, binding]) => binding.node === current)
        .forEach(([name, binding]) => {
          console.warn(
            printHighlightedExpr(
              `"${name}" is defined but never used (no-unused-vars)`,
              binding.identifier.location
            )
          );
        });
    }
  );
}

function noEmptyLet(m: Module): void {
  traverseModule(m, curr => {
    if (!isModule(curr) && curr.node.tag === "let-bindings") {
      if (curr.node.bindings.length === 0) {
        console.warn(
          printHighlightedExpr(
            `no variables bound in let expression (no-empty-let)`,
            curr.location
          )
        );
      }
    }
  });
}

export function lintModule(m: Module): void {
  noUnusedVars(m);
  noEmptyLet(m);
}

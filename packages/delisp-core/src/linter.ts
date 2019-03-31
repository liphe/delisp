import { Module, SIdentifier } from "./syntax";
import { nodeBindings, traverseModule, Visitor } from "./syntax-utils";
import { printHighlightedExpr } from "./error-report";

function noUnusedVars(m: Module): void {
  const used: Set<SIdentifier> = new Set();

  const enterNode: Visitor = (node, refs) => {
    // mark identifier as used
    if (node.tag === "identifier") {
      if (refs.has(node.name)) {
        used.add(refs.get(node.name)!);
      }
    }
  };

  const exitNode: Visitor = node => {
    // lookup all indentifiers that exists only within
    // the context of this node and warn for unused ones
    nodeBindings(node)
      .filter(i => !used.has(i))
      .forEach(i => {
        console.warn(
          printHighlightedExpr(
            `"${i.name}" is defined but never used (no-unused-vars)`,
            i.location
          )
        );
      });
  };

  traverseModule(m, enterNode, exitNode);
}

function noEmptyLet(m: Module): void {
  traverseModule(m, node => {
    if (node.tag === "let-bindings") {
      if (node.bindings.length === 0) {
        console.warn(
          printHighlightedExpr(
            `no variables bound in let expression (no-empty-let)`,
            node.location
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

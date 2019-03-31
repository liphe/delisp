import { Module, SIdentifier, SDefinition } from "./syntax";
import { traverseModule, syntaxBindings, Visitor } from "./syntax-utils";
import { printHighlightedExpr } from "./error-report";

function noUnusedVars(m: Module): void {
  const globals: Map<SIdentifier, SDefinition> = new Map();
  const used: Set<SIdentifier> = new Set();

  const enterNode: Visitor = (s, refs) => {
    // list global definitions
    // TODO: this should be moved to a `module:exit`
    if (s.tag === "definition") {
      if (refs.has(s.variable.name)) {
        globals.set(refs.get(s.variable.name)!, s);
      }
    }

    // mark identifier as used
    if (s.tag === "identifier") {
      if (refs.has(s.name)) {
        used.add(refs.get(s.name)!);
      }
    }
  };

  const exitNode: Visitor = s => {
    if (s.tag === "definition") {
      // definitions are global and can be used
      // outside of the definition node
      return;
    }

    // lookup all indentifiers that exists only within
    // the context of this node and warn for unused ones
    syntaxBindings(s)
      .filter(i => !used.has(i))
      .forEach(i => {
        console.warn(
          printHighlightedExpr(
            `"${i.name}" is defined but never used locally (no-unused-vars)`,
            i.location
          )
        );
      });
  };

  traverseModule(m, enterNode, exitNode);

  // check for unused definitions
  // @TODO should be handled like in exitNode
  globals.forEach((def, sym) => {
    if (used.has(sym)) {
      return;
    }
    console.warn(
      printHighlightedExpr(
        `"${
          def.variable.name
        }" is defined but never used globally (no-unused-vars)`,
        def.variable.location
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

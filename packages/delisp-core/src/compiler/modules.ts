import * as JS from "estree";
import { DefinitionBackend } from "./definitions";
import {
  identifier,
  literal,
  member,
  objectExpression,
  requireModule,
  requireNames
} from "./estree-utils";

export interface ModuleBackend {
  export(vars: string[]): JS.Statement | JS.ModuleDeclaration;
  importRuntime(localName: string): JS.Statement | JS.ModuleDeclaration;
  importRuntimeUtils(names: string[]): JS.Statement | JS.ModuleDeclaration;
  // Import some names from a module in the current definition container
  importNames(
    names: string[],
    source: string,
    def: DefinitionBackend
  ): JS.Statement | JS.ModuleDeclaration;
}

export const cjs: ModuleBackend = {
  export(vars) {
    return {
      type: "ExpressionStatement",
      expression: {
        type: "AssignmentExpression",
        operator: "=",
        left: member(identifier("module"), "exports"),
        right: objectExpression(
          vars.map(vari => ({
            key: vari,
            value: identifier(vari)
          }))
        )
      }
    };
  },

  importRuntime(localName: string) {
    return {
      type: "VariableDeclaration",
      kind: "const",
      declarations: [
        {
          type: "VariableDeclarator",
          id: identifier(localName),
          init: member(requireModule("@delisp/runtime"), "default")
        }
      ]
    };
  },

  importRuntimeUtils(names: string[]) {
    return requireNames(names, "@delisp/runtime");
  },

  importNames(
    names: string[],
    source: string,
    defs: DefinitionBackend
  ): JS.Statement {
    return defs.defineFromObject(names, requireModule(source));
  }
};

export const esm: ModuleBackend = {
  export(vars) {
    return {
      type: "ExportNamedDeclaration",
      exportKind: "value",
      specifiers: vars.map(
        (vari): JS.ExportSpecifier => ({
          type: "ExportSpecifier",
          exported: identifier(vari),
          local: identifier(vari)
        })
      ),
      declaration: null
    };
  },
  importRuntime(localName: string) {
    return {
      type: "ImportDeclaration",
      importKind: "value",
      specifiers: [
        {
          type: "ImportDefaultSpecifier",
          local: identifier(localName)
        }
      ],
      source: literal("@delisp/runtime")
    };
  },
  importRuntimeUtils(names: string[]) {
    return {
      type: "ImportDeclaration",
      importKind: "value",
      specifiers: names.map(name => ({
        type: "ImportSpecifier",
        local: identifier(name),
        imported: identifier(name)
      })),
      source: literal("@delisp/runtime")
    };
  },
  importNames(
    _names: string[],
    _source: string,
    _defs: DefinitionBackend
  ): JS.Statement {
    // TODO: For static compilation, this is easy as we can just
    // generate import {} from "", but remember the target is the
    // definitionsBackend!
    throw new Error(
      `Importing modules is not supported by the ESM module system yet.`
    );
  }
};

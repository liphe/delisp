import * as JS from "estree";
import { member } from "./estree-utils";

export interface ModuleBackend {
  export(vars: string[]): JS.Statement | JS.ModuleDeclaration;
  importRuntime(localName: string): JS.Statement | JS.ModuleDeclaration;
}

export const cjs: ModuleBackend = {
  export(vars) {
    return {
      type: "ExpressionStatement",
      expression: {
        type: "AssignmentExpression",
        operator: "=",
        left: {
          type: "MemberExpression",
          computed: false,
          object: { type: "Identifier", name: "module" },
          property: { type: "Identifier", name: "exports" }
        },

        right: {
          type: "ObjectExpression",
          properties: vars.map(
            (vari): JS.Property => ({
              type: "Property",
              kind: "init",
              key: { type: "Identifier", name: vari },
              value: { type: "Identifier", name: vari },
              method: false,
              computed: false,
              shorthand: true
            })
          )
        }
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
          id: { type: "Identifier", name: localName },
          init: member(
            {
              type: "CallExpression",
              callee: { type: "Identifier", name: "require" },
              arguments: [{ type: "Literal", value: "@delisp/runtime" }]
            },
            "default"
          )
        }
      ]
    };
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
          exported: { type: "Identifier", name: vari },
          local: { type: "Identifier", name: vari }
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
          local: { type: "Identifier", name: localName }
        }
      ],
      source: { type: "Literal", value: "@delisp/runtime" }
    };
  }
};

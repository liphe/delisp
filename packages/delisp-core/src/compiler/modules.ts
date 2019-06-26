import * as JS from "estree";
import { identifier, literal, member, objectExpression } from "./estree-utils";

export interface ModuleBackend {
  export(vars: string[]): JS.Statement | JS.ModuleDeclaration;
  importRuntime(localName: string): JS.Statement | JS.ModuleDeclaration;
  importRuntimeUtils(names: string[]): JS.Statement | JS.ModuleDeclaration;
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
          init: member(
            {
              type: "CallExpression",
              callee: identifier("require"),
              arguments: [literal("@delisp/runtime")]
            },
            "default"
          )
        }
      ]
    };
  },
  importRuntimeUtils(names: string[]) {
    return {
      type: "VariableDeclaration",
      kind: "const",
      declarations: [
        {
          type: "VariableDeclarator",
          id: {
            type: "ObjectPattern",
            properties: names.map(name => ({
              type: "Property",
              kind: "init",
              key: identifier(name),
              value: identifier(name),
              computed: false,
              method: false,
              shorthand: true
            }))
          },
          init: {
            type: "CallExpression",
            callee: identifier("require"),
            arguments: [literal("@delisp/runtime")]
          }
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
  }
};

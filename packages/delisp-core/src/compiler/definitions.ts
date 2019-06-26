import * as JS from "estree";

import { identifier } from "./estree-utils";

export interface DefinitionBackend {
  define(name: string, value: JS.Expression): JS.Statement;
  access(name: string): JS.Expression;
}

//
// Handle static definitions. Those are compiled to static JS
// functions as we won't allow to redefine them. Used during batch
// compilation.
//
export const staticDefinition: DefinitionBackend = {
  define(name, value) {
    return {
      type: "VariableDeclaration",
      kind: "const",
      declarations: [
        {
          type: "VariableDeclarator",
          id: identifier(name),
          init: value
        }
      ]
    };
  },

  access(name) {
    return identifier(name);
  }
};

//
// Dynamic definitions are used in the REPL to allow redefinitions and
// introspection.
//
export function dynamicDefinition(container: string): DefinitionBackend {
  return {
    define(name, value) {
      return {
        type: "ExpressionStatement",
        expression: {
          type: "AssignmentExpression",
          operator: "=",
          left: {
            type: "MemberExpression",
            computed: true,
            object: identifier(container),
            property: {
              type: "Literal",
              value: name
            }
          },
          right: value
        }
      };
    },

    access(name) {
      return {
        type: "MemberExpression",
        computed: true,
        object: identifier(container),
        property: {
          type: "Literal",
          value: name
        }
      };
    }
  };
}

import * as JS from "estree";

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
          id: {
            type: "Identifier",
            name
          },
          init: value
        }
      ]
    };
  },

  access(name) {
    return {
      type: "Identifier",
      name
    };
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
            object: {
              type: "Identifier",
              name: container
            },
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
        object: {
          type: "Identifier",
          name: container
        },
        property: {
          type: "Literal",
          value: name
        }
      };
    }
  };
}

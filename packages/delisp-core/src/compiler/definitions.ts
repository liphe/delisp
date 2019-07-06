import * as JS from "estree";
import {
  arrowFunction,
  identifier,
  member,
  methodCall,
  objectExpression
} from "./estree-utils";

export interface DefinitionBackend {
  define(name: string, value: JS.Expression): JS.Statement;
  defineFromObject(names: string[], obj: JS.Expression): JS.Statement;
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

  defineFromObject(names, obj) {
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
          init: obj
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
export function dynamicDefinition(containerName: string): DefinitionBackend {
  const container = identifier(containerName);

  function define(name: string, value: JS.Expression): JS.Statement {
    return {
      type: "ExpressionStatement",
      expression: {
        type: "AssignmentExpression",
        operator: "=",
        left: member(container, name),
        right: value
      }
    };
  }

  return {
    define,

    defineFromObject(names, obj) {
      return {
        type: "ExpressionStatement",
        expression: methodCall(identifier("Object"), "assign", [
          container,
          {
            type: "CallExpression",
            callee: arrowFunction(
              [identifier("x")],
              [
                objectExpression(
                  names.map(name => {
                    return {
                      key: name,
                      value: member(identifier("x"), name)
                    };
                  })
                )
              ]
            ),
            arguments: [obj]
          }
        ])
      };
    },

    access(name) {
      return member(container, name);
    }
  };
}

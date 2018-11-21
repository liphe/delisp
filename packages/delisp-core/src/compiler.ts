import { ASExpr } from "./syntax";
import * as recast from 'recast';

const debug = require('debug')('delisp:compiler')

type JSAST = object;

function compileList(fn: ASExpr, args: ASExpr[]): JSAST {
  if (fn.type === 'symbol') {
    switch(fn.name) {
      case 'define':
        if (args.length !== 2)
          throw new Error('Define needs exactly 2 arguments')

        const variable = args[0]
        if (variable.type !== 'symbol')
          throw new Error('First argument of define should be a symbol');

        return {
          type: 'AssignmentExpression',
          operator: '=',
          left: {
            type: 'MemberExpression',
            computed: true,
            object: {
              type: 'Identifier',
              name: 'env'
            },
            property: {
              type: 'Literal',
              value: variable.name
            }
          },
          right: compile(args[1])
        }
    }
  }

  return {
    type: 'CallExpression',
    callee: compile(fn),
    arguments: args.map(compile)
  };
}

export function compile(syntax: ASExpr): JSAST {
  switch(syntax.type) {
    case 'number':
      return {
        type: 'NumericLiteral',
        value: syntax.value
      };
    case 'symbol':
      return {
        type: 'MemberExpression',
        computed: true,
        object: {
          type: 'Identifier',
          name: 'env'
        },
        property: {
          type: 'Literal',
          value: syntax.name
        }
      };
    case 'string':
      return {
        type: 'Literal',
        value: syntax.value
      };
    case 'list':
      const [fn, ...args] = syntax.elements;
      return compileList(fn, args)
  }
}

export function compileModule(syntax: ASExpr): JSAST {
  return {
    "type": "File",
    "program": {
      "type": "Program",
      "sourceType": "module",
      "body": [
        {
          "type": "ExpressionStatement",
          "expression": compile(syntax)
        }
      ]
    }
  }
}

export function compileToString(syntax: ASExpr): string {
  const ast = compileModule(syntax);
  debug('jsast:', ast)
  return recast.print(ast).code;
}

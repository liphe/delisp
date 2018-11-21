import { ASExpr } from "./syntax";
import * as recast from 'recast';

const debug = require('debug')('delisp:compiler')

type JSAST = object;

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
        object: {
          type: 'Identifier',
          name: 'env'
        },
        property: {
          type: 'Literal',
          value: syntax.name
        },
        computed: true
      };
    case 'string':
      return {
        type: 'Literal',
        value: syntax.value
      };
    case 'list':
      const [fn, ...args] = syntax.elements;
      return {
        type: 'CallExpression',
        callee: compile(fn),
        arguments: args.map(compile)
      };
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

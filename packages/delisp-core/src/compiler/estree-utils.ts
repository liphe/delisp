import * as JS from "estree";
import { isValidJSIdentifierName } from "./jsvariable";
import { mapObject } from "../utils";
import * as esprima from "esprima";

export function member(obj: JS.Expression, prop: string): JS.MemberExpression {
  const dotNotation = isValidJSIdentifierName(prop);
  return {
    type: "MemberExpression",
    computed: !dotNotation,
    object: obj,
    property: dotNotation
      ? { type: "Identifier", name: prop }
      : { type: "Literal", value: prop }
  };
}

export function methodCall(
  e: JS.Expression,
  method: string,
  args: JS.Expression[]
): JS.CallExpression {
  return {
    type: "CallExpression",
    callee: member(e, method),
    arguments: args
  };
}

export function arrowFunction(
  args: string[],
  body: JS.Expression
): JS.ArrowFunctionExpression {
  return {
    type: "ArrowFunctionExpression",
    params: args.map(name => ({ type: "Identifier", name })),
    body,
    generator: false,
    expression: true,
    async: false
  };
}

export function literal(value: number | string): JS.Literal {
  return {
    type: "Literal",
    value
  };
}

export function identifier(name: string): JS.Identifier {
  return {
    type: "Identifier",
    name
  };
}

export function primitiveCall(
  name: string,
  ...args: JS.Expression[]
): JS.Expression {
  return {
    type: "CallExpression",
    callee: identifier(name),
    arguments: args
  };
}

/** Create some JS AST by interpolating a templated literal with Javascript code. */

function prepareJSTemplate(chunks: TemplateStringsArray): JS.Expression {
  const code = chunks.reduce(
    (acc, c, idx) => acc + ` __delisp_placeholder_${idx} ` + c
  );
  const program = esprima.parseModule(code);
  return (program.body[0] as JS.ExpressionStatement).expression;
}

export function jsexpr(chunks: TemplateStringsArray, ...values: any[]) {
  const tmpl = prepareJSTemplate(chunks);

  function isPlaceholder(node: any): number | null {
    if (node && node.type === "Identifier") {
      const match = node.name && node.name.match(/__delisp_placeholder_(\d+)/);
      if (match) {
        return parseInt(match[1], 10);
      }
      return null;
    } else {
      return null;
    }
  }

  function replacePlaceholders(node: any): any {
    if (Array.isArray(node)) {
      if (node.length === 1) {
        const idx = isPlaceholder(node[0]);
        if (idx && Array.isArray(values[idx - 1])) {
          return values[idx - 1];
        } else {
          return node.map(replacePlaceholders);
        }
      } else {
        return node.map(replacePlaceholders);
      }
    } else if (typeof node !== "object" || node === null) {
      return node;
    } else {
      const idx = isPlaceholder(node);
      if (idx) {
        return values[idx - 1];
      } else {
        return mapObject(node, replacePlaceholders);
      }
    }
  }

  return replacePlaceholders(tmpl);
}

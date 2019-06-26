import * as JS from "estree";
import { isValidJSIdentifierName } from "./jsvariable";

export function member(obj: JS.Expression, prop: string): JS.MemberExpression {
  const dotNotation = isValidJSIdentifierName(prop);
  return {
    type: "MemberExpression",
    computed: !dotNotation,
    object: obj,
    property: dotNotation ? identifier(prop) : literal(prop)
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
    params: args.map(identifier),
    body,
    generator: false,
    expression: true,
    async: false
  };
}

export function literal(value: number | string | boolean | null): JS.Literal {
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

export function op(
  operator: JS.BinaryOperator,
  left: JS.Expression,
  right: JS.Expression
): JS.BinaryExpression {
  return { type: "BinaryExpression", operator, left, right };
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

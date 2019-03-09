import * as JS from "estree";
import { isValidJSIdentifierName } from "./jsvariable";

export function methodCall(
  e: JS.Expression,
  method: string,
  args: JS.Expression[]
): JS.CallExpression {
  return {
    type: "CallExpression",
    callee: {
      type: "MemberExpression",
      object: e,
      property: { type: "Identifier", name: method },
      computed: false
    },
    arguments: args
  };
}

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

import * as S from "./syntax";

const contextIdentifier: S.Identifier = {
  tag: "identifier",
  name: "*context*"
};

function identifier2variable(identifier: S.Identifier): S.SVariableReference {
  return {
    node: { tag: "variable-reference", name: identifier.name },
    info: {}
  };
}

export function lambdaListAllArguments(ll: S.LambdaList): S.Identifier[] {
  return [contextIdentifier, ...ll.userPositionalArguments];
}

export function funcallAllArguments(call: S.SFunctionCall): S.Expression[] {
  return [identifier2variable(contextIdentifier), ...call.node.userArguments];
}

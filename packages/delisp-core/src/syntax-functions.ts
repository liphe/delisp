import * as S from "./syntax";

export function lambdaListAllArguments(ll: S.LambdaList): S.Identifier[] {
  return ll.userPositionalArguments;
}

export function funcallAllArguments(call: S.SFunctionCall): S.Expression[] {
  return call.node.userArguments;
}

import * as S from "./syntax";
import { Location } from "./input";

function contextIdentifier(location: Location): S.Identifier {
  return {
    tag: "identifier",
    name: "*context*",
    location
  };
}

function identifier2variable(identifier: S.Identifier): S.SVariableReference {
  return {
    node: { tag: "variable-reference", name: identifier.name },
    info: {},
    location: identifier.location
  };
}

export function lambdaListAllArguments(ll: S.LambdaList): S.Identifier[] {
  return [contextIdentifier(ll.location), ...ll.userPositionalArguments];
}

export function funcallAllArguments(call: S.SFunctionCall): S.Expression[] {
  return [
    identifier2variable(contextIdentifier(call.location)),
    ...call.node.userArguments
  ];
}

import { Type, TypeSchema } from "./types";

export interface ExternalEnvironment {
  variables: {
    [v: string]: TypeSchema;
  };
  types: {
    [t: string]: Type;
  };
}

export function mergeExternalEnvironments(
  e1: ExternalEnvironment,
  e2: ExternalEnvironment
) {
  return {
    variables: { ...e1.variables, ...e2.variables },
    types: { ...e1.types, ...e2.types }
  };
}

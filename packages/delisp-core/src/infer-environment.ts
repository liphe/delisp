import { either, isLeft } from "fp-ts/lib/Either";
import * as t from "io-ts";
import { PathReporter } from "io-ts/lib/PathReporter";
import { readType } from "./type-convert";
import { printType } from "./type-printer";
import { TypeSchema } from "./types";

const TypeSchemaFromString = new t.Type<TypeSchema, string, unknown>(
  "TypeFromString",
  (u): u is TypeSchema => u instanceof TypeSchema,
  (u, c) =>
    either.chain(t.string.validate(u, c), (s) => {
      try {
        return t.success(readType(s));
      } catch (err) {
        return t.failure(u, c);
      }
    }),
  (a) => printType(a.mono, true)
);

const ExternalEnvironment = t.type({
  variables: t.record(t.string, TypeSchemaFromString),
  types: t.record(t.string, TypeSchemaFromString),
});

export type ExternalEnvironment = t.TypeOf<typeof ExternalEnvironment>;

export function encodeExternalEnvironment(e: ExternalEnvironment) {
  return ExternalEnvironment.encode(e);
}

export function decodeExternalEnvironment(x: unknown) {
  const result = ExternalEnvironment.decode(x);
  if (isLeft(result)) {
    const message = PathReporter.report(result).join("\n");
    throw new Error(message);
  } else {
    return result.right;
  }
}

export function mergeExternalEnvironments(
  e1: ExternalEnvironment,
  e2: ExternalEnvironment
) {
  return {
    variables: { ...e1.variables, ...e2.variables },
    types: { ...e1.types, ...e2.types },
  };
}

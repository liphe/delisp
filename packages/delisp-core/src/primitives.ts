import { primitives } from "@delisp/runtime";

import { readType } from "./type-utils";
import { TypeSchema } from "./types";
import { mapObject } from "./utils";
interface Primitive {
  type: TypeSchema;
  value: unknown;
}

export default mapObject(
  primitives,
  (spec): Primitive => ({
    type: readType(spec.type),
    value: spec.value
  })
);

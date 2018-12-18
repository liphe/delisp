import { primitives } from "@delisp/core";

export default Object.entries(primitives).reduce(
  (runtime, [name, def]) => ({ ...runtime, [name]: def.value }),
  {}
);

import primitives from "./primitives";

export { primitives };

export default Object.entries(primitives).reduce(
  (runtime, [name, def]) => ({ ...runtime, [name]: def.value }),
  {}
);

//
// Variants
//

interface TaggedValue {
  tag: string;
  value: unknown;
}

export function matchTag(
  obj: TaggedValue,
  cases: { [label: string]: (value: unknown) => unknown }
): unknown {
  const handler = cases[obj.tag];
  return handler(obj.value);
}

export function tag(tag: string, value: unknown): TaggedValue {
  return { tag, value };
}

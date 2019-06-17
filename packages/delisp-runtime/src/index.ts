import primitives from "./primitives";

export { primitives };

export default Object.entries(primitives).reduce(
  (runtime, [name, def]) => ({ ...runtime, [name]: def.value }),
  {}
);

//
// Variants
//

export class TaggedValue {
  tag: string;
  value: unknown;
  constructor(tag: string, value: unknown) {
    this.tag = tag;
    this.value = value;
  }
}

export function matchTag(
  obj: TaggedValue,
  cases: { [label: string]: (value: unknown) => unknown },
  defaultCase?: () => unknown
): unknown {
  const handler = cases[obj.tag] || defaultCase;
  return handler(obj.value);
}

export function tag(tag: string, value: unknown): TaggedValue {
  return new TaggedValue(tag, value);
}

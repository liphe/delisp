/** Error used to report when assumptions of the code are not met. */
export class InvariantViolation extends Error {
  meta: unknown;
  constructor(message: string, meta: unknown = {}) {
    super(message);
    this.name = "InvariantViolation";
    this.meta = meta;
  }
}

export function assertNever(x: never): never {
  throw new Error("Unexpected object: " + x);
}

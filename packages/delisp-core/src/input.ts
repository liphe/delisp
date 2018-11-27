export type Offset = number;

/** Start and end offset in the original input of a parsed value. */
export interface Location {
  input: Input;
  start: Offset;
  end: Offset;
}

// Input for the parsers. It keeps track of the current offset, so we
// can build `Location` objects out of it.
export class Input {
  private input: string;
  readonly offset: Offset;

  constructor(input: string, offset: Offset = 0) {
    this.input = input;
    this.offset = offset;
  }

  readChars(n: number): [string, Input] {
    return [
      this.input.slice(this.offset, this.offset + n),
      new Input(this.input, this.offset + n)
    ];
  }

  /** Return the full input as a string. */
  toString() {
    return this.input;
  }
}

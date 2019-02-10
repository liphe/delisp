import { readAllFromString, readFromString } from "../src/reader";

describe("Reader", () => {
  it("should read numbers", () => {
    expect(readFromString("12")).toMatchObject({
      type: "number",
      value: 12,
      location: { start: 0, end: 2 }
    });
    expect(readFromString("  12  ")).toMatchObject({
      type: "number",
      value: 12,
      location: { start: 2, end: 4 }
    });
    expect(readFromString("  -12  ")).toMatchObject({
      type: "number",
      value: -12,
      location: { start: 2, end: 5 }
    });
  });

  it("should read strings", () => {
    expect(readFromString('  "xyz"  ')).toMatchObject({
      type: "string",
      value: "xyz",
      location: { start: 2, end: 7 }
    });

    expect(readFromString('  "a\\nb"  ')).toMatchObject({
      type: "string",
      value: "a\nb",
      location: { start: 2, end: 8 }
    });
  });

  it("should read symbols", () => {
    expect(readFromString("  xyz  ")).toMatchObject({
      type: "symbol",
      name: "xyz",
      location: { start: 2, end: 5 }
    });

    expect(readFromString("  a2  ")).toMatchObject({
      type: "symbol",
      name: "a2",
      location: { start: 2, end: 4 }
    });

    expect(readFromString("  $bc  ")).toMatchObject({
      type: "symbol",
      name: "$bc",
      location: { start: 2, end: 5 }
    });
  });

  it("should read lists", () => {
    expect(readFromString("()")).toMatchObject({
      type: "list",
      shape: "round",
      elements: [],
      location: { start: 0, end: 2 }
    });
    expect(readFromString("(  )")).toMatchObject({
      type: "list",
      shape: "round",
      elements: [],
      location: { start: 0, end: 4 }
    });
    expect(readFromString("(1 2 3)")).toMatchObject({
      type: "list",
      shape: "round",
      elements: [
        {
          type: "number",
          value: 1,
          location: { start: 1, end: 2 }
        },
        {
          type: "number",
          value: 2,
          location: { start: 3, end: 4 }
        },
        {
          type: "number",
          value: 3,
          location: { start: 5, end: 6 }
        }
      ],
      location: { start: 0, end: 7 }
    });

    expect(readFromString(" (1 ( 2 ) 3) ")).toMatchObject({
      type: "list",
      shape: "round",
      elements: [
        {
          type: "number",
          value: 1,
          location: { start: 2, end: 3 }
        },
        {
          type: "list",
          elements: [
            {
              type: "number",
              value: 2,
              location: { start: 6, end: 7 }
            }
          ],
          location: { start: 4, end: 9 }
        },
        {
          type: "number",
          value: 3,
          location: { start: 10, end: 11 }
        }
      ],
      location: { start: 1, end: 12 }
    });
  });

  it("should read lists with square bracket notation", () => {
    expect(readFromString("[]")).toMatchObject({
      type: "list",
      shape: "square",
      elements: [],
      location: { start: 0, end: 2 }
    });
    expect(readFromString("[  ]")).toMatchObject({
      type: "list",
      shape: "square",
      elements: [],
      location: { start: 0, end: 4 }
    });
    expect(readFromString("[1 2 3]")).toMatchObject({
      type: "list",
      shape: "square",
      elements: [
        {
          type: "number",
          value: 1,
          location: { start: 1, end: 2 }
        },
        {
          type: "number",
          value: 2,
          location: { start: 3, end: 4 }
        },
        {
          type: "number",
          value: 3,
          location: { start: 5, end: 6 }
        }
      ],
      location: { start: 0, end: 7 }
    });

    expect(readFromString(" [1 [ 2 ] 3] ")).toMatchObject({
      type: "list",
      shape: "square",
      elements: [
        {
          type: "number",
          value: 1,
          location: { start: 2, end: 3 }
        },
        {
          type: "list",
          elements: [
            {
              type: "number",
              value: 2,
              location: { start: 6, end: 7 }
            }
          ],
          location: { start: 4, end: 9 }
        },
        {
          type: "number",
          value: 3,
          location: { start: 10, end: 11 }
        }
      ],
      location: { start: 1, end: 12 }
    });
  });

  it("should read multiple S-expressions", () => {
    expect(readAllFromString("(x 1 2)(y 3)")).toMatchObject([
      { type: "list" },
      { type: "list" }
    ]);

    expect(readAllFromString(" (x 1 2) (y 3) ")).toMatchObject([
      { type: "list" },
      { type: "list" }
    ]);

    expect(
      readAllFromString(`
      (x 1 2)
      (y 3)
    `)
    ).toMatchObject([{ type: "list" }, { type: "list" }]);
  });

  describe("Error messages", () => {
    const failedRead = (x: string) => {
      try {
        readFromString(x);
        throw new Error(`This expression didn't fail!`);
      } catch (err) {
        return err.message;
      }
    };

    it("generate user-friendly error for an incomplete list", () => {
      expect(failedRead("(1 2 3")).toMatchSnapshot();
    });

    it("generate user-friendly error for a closing parenthesis", () => {
      expect(failedRead(")")).toMatchSnapshot();
    });

    it("generate user-friendly error for an incomplete string", () => {
      expect(failedRead('"foo')).toMatchSnapshot();
    });

    it("generate user-friendly error for badly escaped string", () => {
      expect(failedRead('"ab\\xyz"')).toMatchSnapshot();
    });

    it("generate a user-friendly error for incomplete escaped string", () => {
      expect(failedRead('"abc\\')).toMatchSnapshot();
    });
  });

  it("should detect incomplete inputs", () => {
    const read = (x: string) => {
      try {
        readFromString(x);
        return undefined;
      } catch (err) {
        return err.incomplete;
      }
    };

    const readAll = (x: string) => {
      try {
        readAllFromString(x);
        return undefined;
      } catch (err) {
        return err.incomplete;
      }
    };

    expect(read("(1 2 3")).toBe(true);
    expect(read(")")).toBe(false);
    expect(read('"foo')).toBe(true);
    expect(read('"ab\\xyz"')).toBe(false);
    expect(read('"abc\\')).toBe(true);

    expect(readAll("(1 2 3)(4 5")).toBe(true);
    expect(readAll("(1 2 3)4 5)")).toBe(false);
    expect(readAll("((1 2 3)")).toBe(true);
    expect(readAll("(1 2 3))")).toBe(false);
  });
});

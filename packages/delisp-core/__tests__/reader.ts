import { readAllFromString, readFromString } from "../src/reader";
import { ASExpr } from "../src/sexpr";

function removeLocation(x: ASExpr): object {
  switch (x.tag) {
    case "number":
    case "symbol":
    case "string": {
      const { location: _, ...props } = x;
      return props;
    }
    case "list":
    case "vector": {
      const { location: _, ...props } = x;
      return {
        ...props,
        elements: x.elements.map(removeLocation),
      };
    }
    case "map": {
      const { location: _, ...props } = x;
      return {
        ...props,
        fields: x.fields.map((f) => ({
          label: f.label,
          value: removeLocation(f.value),
        })),
      };
    }
  }
}

describe("Reader", () => {
  it("should read numbers", () => {
    expect(readFromString("12")).toMatchObject({
      tag: "number",
      value: 12,
      location: { start: 0, end: 2 },
    });
    expect(readFromString("  12  ")).toMatchObject({
      tag: "number",
      value: 12,
      location: { start: 2, end: 4 },
    });
    expect(readFromString("  -12  ")).toMatchObject({
      tag: "number",
      value: -12,
      location: { start: 2, end: 5 },
    });
    expect(readFromString("  0.05  ")).toMatchObject({
      tag: "number",
      value: 0.05,
      location: { start: 2, end: 6 },
    });
    expect(readFromString("  -0.9  ")).toMatchObject({
      tag: "number",
      value: -0.9,
      location: { start: 2, end: 6 },
    });
  });

  it("should read strings", () => {
    expect(readFromString('  "xyz"  ')).toMatchObject({
      tag: "string",
      value: "xyz",
      location: { start: 2, end: 7 },
    });

    expect(readFromString('  "a\\nb"  ')).toMatchObject({
      tag: "string",
      value: "a\nb",
      location: { start: 2, end: 8 },
    });
  });

  it("should read symbols", () => {
    expect(readFromString("  xyz  ")).toMatchObject({
      tag: "symbol",
      name: "xyz",
      location: { start: 2, end: 5 },
    });

    expect(readFromString("  a2  ")).toMatchObject({
      tag: "symbol",
      name: "a2",
      location: { start: 2, end: 4 },
    });

    expect(readFromString("  3d  ")).toMatchObject({
      tag: "symbol",
      name: "3d",
      location: { start: 2, end: 4 },
    });

    expect(readFromString("  $bc  ")).toMatchObject({
      tag: "symbol",
      name: "$bc",
      location: { start: 2, end: 5 },
    });
  });

  it("should read lists", () => {
    expect(readFromString("()")).toMatchObject({
      tag: "list",
      elements: [],
      location: { start: 0, end: 2 },
    });
    expect(readFromString("(  )")).toMatchObject({
      tag: "list",
      elements: [],
      location: { start: 0, end: 4 },
    });
    expect(readFromString("(1 2 3)")).toMatchObject({
      tag: "list",
      elements: [
        {
          tag: "number",
          value: 1,
          location: { start: 1, end: 2 },
        },
        {
          tag: "number",
          value: 2,
          location: { start: 3, end: 4 },
        },
        {
          tag: "number",
          value: 3,
          location: { start: 5, end: 6 },
        },
      ],
      location: { start: 0, end: 7 },
    });

    expect(readFromString(" (1 ( 2 ) 3) ")).toMatchObject({
      tag: "list",
      elements: [
        {
          tag: "number",
          value: 1,
          location: { start: 2, end: 3 },
        },
        {
          tag: "list",
          elements: [
            {
              tag: "number",
              value: 2,
              location: { start: 6, end: 7 },
            },
          ],
          location: { start: 4, end: 9 },
        },
        {
          tag: "number",
          value: 3,
          location: { start: 10, end: 11 },
        },
      ],
      location: { start: 1, end: 12 },
    });
  });

  it("should read vectors with square bracket notation", () => {
    expect(readFromString("[]")).toMatchObject({
      tag: "vector",
      elements: [],
      location: { start: 0, end: 2 },
    });
    expect(readFromString("[  ]")).toMatchObject({
      tag: "vector",
      elements: [],
      location: { start: 0, end: 4 },
    });
    expect(readFromString("[1 2 3]")).toMatchObject({
      tag: "vector",
      elements: [
        {
          tag: "number",
          value: 1,
          location: { start: 1, end: 2 },
        },
        {
          tag: "number",
          value: 2,
          location: { start: 3, end: 4 },
        },
        {
          tag: "number",
          value: 3,
          location: { start: 5, end: 6 },
        },
      ],
      location: { start: 0, end: 7 },
    });

    expect(readFromString(" [1 [ 2 ] 3] ")).toMatchObject({
      tag: "vector",
      elements: [
        {
          tag: "number",
          value: 1,
          location: { start: 2, end: 3 },
        },
        {
          tag: "vector",
          elements: [
            {
              tag: "number",
              value: 2,
              location: { start: 6, end: 7 },
            },
          ],
          location: { start: 4, end: 9 },
        },
        {
          tag: "number",
          value: 3,
          location: { start: 10, end: 11 },
        },
      ],
      location: { start: 1, end: 12 },
    });
  });

  it("should read multiple S-expressions", () => {
    expect(readAllFromString("(x 1 2)(y 3)")).toMatchObject([
      { tag: "list" },
      { tag: "list" },
    ]);

    expect(readAllFromString(" (x 1 2) (y 3) ")).toMatchObject([
      { tag: "list" },
      { tag: "list" },
    ]);

    expect(
      readAllFromString(`
      (x 1 2)
      (y 3)
    `)
    ).toMatchObject([{ tag: "list" }, { tag: "list" }]);
  });

  describe("Error messages", () => {
    const failedRead = (x: string) => {
      try {
        readFromString(x);
      } catch (err) {
        return err.message;
      }
      throw new Error(`This expression didn't fail!`);
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

    expect(readAll("@{abc")).toBe(true);
  });

  describe("@-syntax", () => {
    expect(removeLocation(readFromString("@{hello world}"))).toEqual(
      removeLocation(readFromString(`(comment "hello world")`))
    );
    expect(removeLocation(readFromString("@comment{hello world}"))).toEqual(
      removeLocation(readFromString(`(comment "hello world")`))
    );
    expect(
      removeLocation(
        readFromString("@desc{see @ref{note-1} for further information}")
      )
    ).toEqual(
      removeLocation(
        readFromString(
          `(desc "see " (ref "note-1") " for further information")`
        )
      )
    );
  });
});

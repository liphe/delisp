import { getParserError } from "../src/parser-combinators";
import { readFromString } from "../src/reader";

describe("Reader", () => {
  it("should read numbers", () => {
    expect(readFromString("12")).toEqual({
      type: "number",
      value: 12,
      location: { start: 0, end: 2 }
    });
    expect(readFromString("  12  ")).toEqual({
      type: "number",
      value: 12,
      location: { start: 2, end: 4 }
    });
    expect(readFromString("  -12  ")).toEqual({
      type: "number",
      value: -12,
      location: { start: 2, end: 5 }
    });
  });

  it("should read strings", () => {
    expect(readFromString('  "xyz"  ')).toEqual({
      type: "string",
      value: "xyz",
      location: { start: 2, end: 7 }
    });

    expect(readFromString('  "a\\nb"  ')).toEqual({
      type: "string",
      value: "a\nb",
      location: { start: 2, end: 8 }
    });
  });

  it("should read symbols", () => {
    expect(readFromString("  xyz  ")).toEqual({
      type: "symbol",
      name: "xyz",
      location: { start: 2, end: 5 }
    });
  });

  it("should read lists", () => {
    expect(readFromString("()")).toEqual({
      type: "list",
      elements: [],
      location: { start: 0, end: 2 }
    });
    expect(readFromString("(  )")).toEqual({
      type: "list",
      elements: [],
      location: { start: 0, end: 4 }
    });
    expect(readFromString("(1 2 3)")).toEqual({
      type: "list",
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

    expect(readFromString(" (1 ( 2 ) 3) ")).toEqual({
      type: "list",
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

  it("should generate user-friendly errors", () => {
    const failedRead = (x: string) => {
      try {
        readFromString(x);
        throw new Error(`This expression didn't fail!`);
      } catch (err) {
        return err.message;
      }
    };
    expect(failedRead("(1 2 3")).toMatchSnapshot();
    expect(failedRead(")")).toMatchSnapshot();
    expect(failedRead('"foo')).toMatchSnapshot();
    expect(failedRead('"ab\\xyz"')).toMatchSnapshot();
    expect(failedRead('"abc\\')).toMatchSnapshot();
  });
});

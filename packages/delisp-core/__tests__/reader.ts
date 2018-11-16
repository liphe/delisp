import { readFromString } from "../src/reader";

describe("Reader", () => {
  const readWithLocation = (str: string) => {
    const result = readFromString(str);
    if (result.status !== "success") {
      throw new Error(`Couldn ot read ${str}`);
    }
    return result.value;
  };

  it("should read numbers", () => {
    expect(readWithLocation("12")).toEqual({
      type: "number",
      value: 12,
      location: { start: 0, end: 2 }
    });
    expect(readWithLocation("  12  ")).toEqual({
      type: "number",
      value: 12,
      location: { start: 2, end: 4 }
    });
  });

  it("should read strings", () => {
    expect(readWithLocation('  "xyz"  ')).toEqual({
      type: "string",
      value: "xyz",
      location: { start: 2, end: 7 }
    });

    expect(readWithLocation('  "a\\nb"  ')).toEqual({
      type: "string",
      value: "a\nb",
      location: { start: 2, end: 8 }
    });
  });

  it("should read symbols", () => {
    expect(readWithLocation("  xyz  ")).toEqual({
      type: "symbol",
      name: "xyz",
      location: { start: 2, end: 5 }
    });
  });

  it("should read lists", () => {
    expect(readWithLocation("()")).toEqual({
      type: "list",
      elements: [],
      location: { start: 0, end: 2 }
    });
    expect(readWithLocation("(  )")).toEqual({
      type: "list",
      elements: [],
      location: { start: 0, end: 4 }
    });
    expect(readWithLocation("(1 2 3)")).toEqual({
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

    expect(readWithLocation(" (1 ( 2 ) 3) ")).toEqual({
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
});

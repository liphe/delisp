import {
  capitalize,
  difference,
  equals,
  flatMap,
  flatten,
  intersection,
  last,
  mapObject,
  range,
  union,
  unique
} from "./utils";

describe("Utils", () => {
  describe("flatMap", () => {
    it("x => [x] should preserve the list", () => {
      expect(flatMap(x => [x], [1, 2, 3])).toEqual([1, 2, 3]);
    });
  });
  describe("flatten", () => {
    it("flat nested lists", () => {
      expect(flatten([[1], [2], [3]])).toEqual([1, 2, 3]);
      expect(flatten([[1, 2], [3]])).toEqual([1, 2, 3]);
      expect(flatten([[1], [2, 3]])).toEqual([1, 2, 3]);
      expect(flatten([[], [1, 2, 3]])).toEqual([1, 2, 3]);
    });
  });
  describe("union", () => {
    it("empty list is an identity element", () => {
      expect(union([1, 2, 3], [])).toEqual([1, 2, 3]);
      expect(union([], [1, 2, 3])).toEqual([1, 2, 3]);
      expect(union([], [])).toEqual([]);
    });
    it("will not repeat duplicated elements", () => {
      expect(union([1, 2, 3], [2, 3, 4])).toEqual([1, 2, 3, 4]);
    });
  });
  describe("intersection", () => {
    it("is always empty for the empty list ", () => {
      expect(intersection([1, 2, 3], [])).toEqual([]);
      expect(intersection([], [1, 2, 3])).toEqual([]);
      expect(intersection([], [])).toEqual([]);
    });
    it("will not include repeated elements", () => {
      expect(intersection([1], [1])).toEqual([1]);
    });
  });
  describe("difference", () => {
    it("for the empty list", () => {
      expect(difference([1, 2, 3], [])).toEqual([1, 2, 3]);
      expect(difference([], [1, 2, 3])).toEqual([]);
      expect(difference([], [])).toEqual([]);
    });
  });
  describe("unique", () => {
    it("is empty for empty lists", () => {
      expect(unique([])).toEqual([]);
    });
    it("will not include duplicated elements", () => {
      expect(unique([1, 1, 3])).toEqual([1, 3]);
    });
  });
  describe("last", () => {
    it("returns undefined for empty lists", () => {
      expect(last([])).toBeUndefined();
    });
    it("returns the last element for singleton list", () => {
      expect(last([1])).toEqual(1);
    });
  });
  describe("mapObject", () => {
    it("will map values of objects", () => {
      expect(mapObject({ x: 10, y: 20 }, x => x * x)).toEqual({
        x: 100,
        y: 400
      });
    });
    it("will call the callback with the key as a second argument", () => {
      expect(mapObject({ x: 10, y: 20 }, (_, key) => key)).toEqual({
        x: "x",
        y: "y"
      });
    });
  });
  describe("range", () => {
    it("returns the right list for 10", () => {
      expect(range(10)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });
    it("is empty for non-positive integers", () => {
      expect(range(0)).toEqual([]);
      expect(range(-1)).toEqual([]);
    });
  });
  describe("equals", () => {
    it("empty arrays are equal", () => {
      expect(equals([], [])).toBeTruthy();
    });
    it("lists of empty length are always different", () => {
      expect(equals([1], [1, 1])).toBeFalsy();
    });
    it("detects equal arrays", () => {
      expect(equals([1, 2, 3], [1, 2, 3])).toBeTruthy();
    });
    it("detects differences in the order of elements", () => {
      expect(equals([1, 2, 3], [2, 3, 1])).toBeFalsy();
    });
  });

  describe("capitalize", () => {
    expect(capitalize("")).toBe("");
    expect(capitalize("foo")).toBe("Foo");
    expect(capitalize("FOO")).toBe("FOO");
  });
});

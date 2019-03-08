import {
  escapeIdentifier,
  isValidJSIdentifier,
  isValidJSIdentifierName
} from "./jsvariable";

describe("Check valid JS identifier name", () => {
  it("should return false for invalid JS identifier names", () => {
    expect(isValidJSIdentifierName("foo?")).toBe(false);
    expect(isValidJSIdentifierName("123")).toBe(false);
    expect(isValidJSIdentifierName("2dVector")).toBe(false);
  });
  it("should return true for valid JS identifier names", () => {
    expect(isValidJSIdentifierName("isFoo")).toBe(true);
    expect(isValidJSIdentifierName("$123")).toBe(true);
    expect(isValidJSIdentifierName("_123")).toBe(true);
    expect(isValidJSIdentifierName("Vector2D")).toBe(true);
    expect(isValidJSIdentifierName("default")).toBe(true);
    expect(isValidJSIdentifierName("const")).toBe(true);
  });
});

describe("Check valid JS identifier", () => {
  it("should return false for invalid JS identifiers", () => {
    expect(isValidJSIdentifier("const")).toBe(false);
    expect(isValidJSIdentifier("default")).toBe(false);
  });
  it("should return true for valid JS identifiers", () => {
    expect(isValidJSIdentifier("_const")).toBe(true);
    expect(isValidJSIdentifier("$default")).toBe(true);
  });
});

describe("Variable name translation", () => {
  it("should escape delisp variable characters not allowed in Javascript", () => {
    const cases = [
      "$",
      "+",
      "-",
      "*",
      "/",
      "int?",
      "a->b",
      "<=",
      "%compile",
      "!foo",
      "&foo"
    ];
    const result = cases.map(v => ({
      delisp: v,
      js: escapeIdentifier(v)
    }));
    return expect(result).toMatchSnapshot();
  });

  it("should fail for not allowed characters", () => {
    expect(() => escapeIdentifier("``")).toThrow();
  });
});

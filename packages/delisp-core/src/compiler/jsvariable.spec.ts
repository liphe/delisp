import { varnameToJS } from "./jsvariable";

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
      js: varnameToJS(v)
    }));
    return expect(result).toMatchSnapshot();
  });

  it("should fail for not allowed characters", () => {
    expect(() => varnameToJS("``")).toThrow();
  });
});

import { type } from "./type-tag";
import { isConstantApplicationType, normalizeRow } from "./type-utils";
import { TApplication, tNumber, tValues } from "./types";
import { last } from "./utils";

describe("Type tag template", () => {
  test("should normalize function types if multiple values into a placeholder", () => {
    const t = type`(-> number _ ${tValues([tNumber, tNumber])})`;
    const out = last((t as TApplication).node.args)!;
    expect(isConstantApplicationType(out, "values")).toBeTruthy();

    const outvalues = normalizeRow((out as TApplication).node.args[0]);
    const primary = outvalues.fields.find(f => f.label === "0")!.labelType;
    expect(isConstantApplicationType(primary, "values")).toBeFalsy();
  });

  test("should normalize function types if a single type is passed in a placeholder as output", () => {
    const t = type`(-> number _ ${tNumber})`;
    const out = last((t as TApplication).node.args)!;
    expect(isConstantApplicationType(out, "values")).toBeTruthy();
  });
});

import { type } from "./type-tag";
import { isConstantApplicationType, normalizeRow } from "./type-utils";
import * as T from "./types";
import { last } from "./utils";

describe("Type tag template", () => {
  test("should normalize function types if multiple values into a placeholder", () => {
    const t = type`(-> number _ ${T.values([T.number, T.number])})`;
    const out = last((t as T.Application).node.args)!;
    expect(isConstantApplicationType(out, "values")).toBeTruthy();

    const outvalues = normalizeRow((out as T.Application).node.args[0]);
    const primary = outvalues.fields.find((f) => f.label === "0")!.labelType;
    expect(isConstantApplicationType(primary, "values")).toBeFalsy();
  });

  test("should normalize function types if a single type is passed in a placeholder as output", () => {
    const t = type`(-> number _ ${T.number})`;
    const out = last((t as T.Application).node.args)!;
    expect(isConstantApplicationType(out, "values")).toBeTruthy();
  });
});

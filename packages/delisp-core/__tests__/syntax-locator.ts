import { readModule } from "../src/module";
import { findSyntaxByOffset } from "../src/syntax-utils";

function cursorAt(source_: string) {
  const [before, after] = source_.split("_|_");
  const code = before + after;
  const offset = before.length;
  const m = readModule(code);
  return findSyntaxByOffset(m, offset);
}

describe("findSyntaxByOffset", () => {
  it.skip("should give the right location in a defined symbol", () => {
    const s = cursorAt(`(define abc_|_def 10)`) as any;
    expect(s.type).toBe("symbol");
    expect(s.type.name).toBe("abcdef");
  });

  it("should give the right location in a variable reference", () => {
    const s = cursorAt(`(define x a_|_ms)`) as any;
    expect(s.type).toBe("variable-reference");
    expect(s.name).toBe("ams");
  });

  it("should give the conditional node", () => {
    const s = cursorAt(`(i_|_f true 1 2)`) as any;
    expect(s.type).toBe("conditional");
  });
});

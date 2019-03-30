import { readModule } from "../src/module";
import { findSyntaxByOffset, findSyntaxByRange } from "../src/syntax-utils";

function cursorAt(source_: string) {
  const [before, after] = source_.split("_|_");
  const code = before + after;
  const offset = before.length;
  const m = readModule(code);
  return findSyntaxByOffset(m, offset);
}

function rangeAt(source_: string) {
  const [before, selected, after] = source_.split("_|_");
  const code = before + selected + after;
  const start = before.length;
  const end = before.length + selected.length;
  const m = readModule(code);
  return findSyntaxByRange(m, start, end);
}

describe("findSyntaxByOffset", () => {
  it.skip("should give the right location in a defined symbol", () => {
    const s = cursorAt(`(define abc_|_def 10)`) as any;
    expect(s.tag).toBe("symbol");
    expect(s.tag.name).toBe("abcdef");
  });

  it("should give the right location in an identifier", () => {
    const s = cursorAt(`(define x a_|_ms)`) as any;
    expect(s.tag).toBe("identifier");
    expect(s.name).toBe("ams");
  });

  it("should give the conditional node", () => {
    const s = cursorAt(`(i_|_f true 1 2)`) as any;
    expect(s.tag).toBe("conditional");
  });

  it("should give the type annotation node", () => {
    const s = cursorAt(`(lambda () (th_|_e [number] []))`)!;
    expect(s.tag).toBe("type-annotation");
  });
});

describe("findSyntaxByRange", () => {
  it("should give a single selected expression", () => {
    const s = rangeAt(`(define x [111 222 3_|_3_|_3 444 555])`) as any;
    expect(s.tag).toBe("number");
  });

  it("should give the parent for multiple selected expressions", () => {
    const s = rangeAt(`(define x [111 2_|_22 333 44_|_4 555])`) as any;
    expect(s.tag).toBe("vector");
  });
});

import { readSyntax } from "../src/index";
import { pprint } from "../src/printer";

function pprintString(source: string, lineWidth: number = 80) {
  const syntax = readSyntax(source);
  return pprint(syntax, lineWidth);
}

describe("Pretty Printer", () => {
  it("should print lambda abstractions beautifully", () => {
    expect(pprintString("(lambda (aaa bbb ccc) xxx)")).toMatchSnapshot();
    expect(
      pprintString(
        "(lambda (aaa bbb ccc ddd eee fff ggg hhh iii jjj kkk lll mmm nnn ooo ppp qqq) xxx)"
      )
    ).toMatchSnapshot();
    expect(
      pprintString(
        "(lambda (aaa bbb ccc ddd eee fff ggg hhh iii jjj kkk lll mmm nnn ooo ppp qqq rrr sss ttt uuu vvv www xx) xxx)"
      )
    ).toMatchSnapshot();
  });
});

import { readSyntax } from "../src/index";
import { pprint } from "../src/printer";

function pprintString(source: string, lineWidth: number = 80) {
  const syntax = readSyntax(source);
  return "\n" + pprint(syntax, lineWidth);
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

  it("shold print definitions beautifully", () => {
    expect(pprintString("(define x 10)")).toMatchSnapshot();
    expect(
      pprintString(
        "(define x (lambda (aaa bbb ccc ddd eee fff ggg hhh iii jjj kkk lll mmm nnn ooo ppp qqq rrr sss ttt uuu vvv www xx) xxx))"
      )
    ).toMatchSnapshot();
  });

  it("should align nested function calls", () => {
    expect(
      pprintString(
        "(funcall aaaaa aaaaa aaaaa aaaaa aaaaa aaaaa aaaaa aaaaa (fxyz 000 111 222) aaaaa aaaaa aaaaa aaaaa aaaaa aaaaa aaaaa)"
      )
    ).toMatchSnapshot();

    expect(
      pprintString("(funcall aaaaa aaaaa aaaaa (fxyz 000 111 222))")
    ).toMatchSnapshot();

    expect(
      pprintString(
        "(funcall aaaaa aaaaa aaaaa (fxyz 000 111 222 333 444 555 666 777 888 999 aaa bbb xxx yyy zzz www uuu ttt))"
      )
    ).toMatchSnapshot();
  });

  it("should pretty print a combination of lambda and function call", () => {
    expect(
      pprintString(
        "(foo (lambda (x y z) (funcall aaaaa aaaaa aaaaa (fxyz 000 111 222 333 444 555 666 777 888 999 aaa bbb xxx yyy zzz www uuu ttt))))"
      )
    ).toMatchSnapshot();
  });
});

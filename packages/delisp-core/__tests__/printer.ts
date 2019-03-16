import { readModule, readSyntax } from "../src/index";
import { pprint, pprintModule } from "../src/printer";

function pprintString(source: string, lineWidth: number = 80) {
  const syntax = readSyntax(source);
  return "\n" + pprint(syntax, lineWidth);
}

function pprintLines(source: string, lineWidth: number = 80) {
  const m = readModule(source);
  return "\n" + pprintModule(m, lineWidth);
}

describe("Pretty Printer", () => {
  it("should insert newlines", () => {
    expect(pprintLines(`aaa bbb ccc`)).toMatchSnapshot();
  });
  it("should preserve some empty lines", () => {
    expect(
      pprintLines(`
aaa
bbb

ccc
ddd


eee
`)
    ).toMatchSnapshot();
  });

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

  it("should print amll real code beautifully", () => {
    expect(
      pprintString(
        `
(define bq-frob
  (lambda (x)
    (and (consp x) (or (eq (car x) *comma*) (eq (car x) *comma-atsign*)))))
`
      )
    ).toMatchSnapshot();
  });

  it("should place all arguments of a function call in the next line if necessary", () => {
    expect(
      pprintString(
        `
(this-is-a-very-long-and-ugly-function-name
 (axbxcxd (a b c d)
          (a b c d)
          (a b c d)
          (a b c d)
          (a b c d)))
`,
        40
      )
    ).toMatchSnapshot();
  });

  it("should print deeply nested function calls nicely", () => {
    expect(
      pprintString(`
(function-call-1 (function-call-2 (function-call-3 (function-call-4 (function-call-5 3
                                                                                     4
                                                                                     5
                                                                                     6
                                                                                     7))))
                 30)`)
    ).toMatchSnapshot();
  });

  it("should print let expressions nicely", () => {
    expect(pprintString(`(let {x 10 y 20} (+ x y))`)).toMatchSnapshot();
  });

  it("should print conditional expressions nicely", () => {
    expect(pprintString(`(if true 1 2)`)).toMatchSnapshot();
    expect(
      pprintString(
        `(if aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa 1 2)`
      )
    ).toMatchSnapshot();
  });

  it("should print empty vectors", () => {
    expect(pprintString(`[]`)).toMatchSnapshot();
  });

  it("should print empty records", () => {
    expect(pprintString(`{}`)).toMatchSnapshot();
  });

  it("should print records with nested expressions", () => {
    expect(
      pprintString(
        `{:xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx 20 :z (* 10 (+ 1 2))}`
      )
    ).toMatchSnapshot();
  });

  it("should some real code", () => {
    expect(
      pprintString(
        `
(define maptree
  (lambda (fn x)
    (if (atom x)
          (funcall fn x)
          (let {a (funcall fn (car x))
                d (maptree fn (cdr x))}
            (if (and (eql a (car x)) (eql d (cdr x)))
                x
                (cons a d))))))
`
      )
    ).toMatchSnapshot();
  });

  it("should print lambda with multiple forms", () => {
    expect(
      pprintString(
        `
(define hello (lambda (x)
                (print x)
                (print x)
                (print x)
                (print x)
                (print x)
                (print x)))
`
      )
    ).toMatchSnapshot();
  });

  it("should pretty print type declarations", () => {
    expect(
      pprintString(
        `(type Person {:name string :age number :books [{:name string :author string}]}) `
      )
    ).toMatchSnapshot();
  });
});

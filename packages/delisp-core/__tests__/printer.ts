import { readModule } from "../src/index";
import { pprintModule } from "../src/printer";

function pprintSource(source: string, lineWidth: number = 80) {
  const m = readModule(source);
  return "\n" + pprintModule(m, lineWidth);
}

function sansSpace(str: string) {
  return str && str.replace(/\s/g, "");
}

function prettySimilar(src: string) {
  expect(sansSpace(pprintSource(src))).toBe(sansSpace(src));
}

describe("Pretty Printer", () => {
  it("should insert newlines", () => {
    expect(pprintSource(`aaa bbb ccc`)).toMatchSnapshot();
  });
  it("should preserve some empty lines", () => {
    expect(
      pprintSource(`
aaa
bbb

ccc
ddd


eee
`)
    ).toMatchSnapshot();
  });

  it("should only touch spaces and newlines", () => {
    prettySimilar(`(define sqr (lambda (x) (* x x))) (export sqr)`);

    prettySimilar(
      `(lambda (name age) {:name (the string name) :age (the number age)})`
    );

    prettySimilar(
      `(define foo (lambda (a b)
         (let {ap100 (+ 100 a) bsum (fold + b 0) msg "Hello!"}
         (print msg)
         {:x ap100 :y [bsum bsum bsum]}
         ))) (export foo)`
    );

    prettySimilar(
      `(the (-> string _a {:name string :info _a}) (lambda (name info) {:name name :info info}))`
    );
  });

  it("should retain partial type annotations", () => {
    prettySimilar(
      `(the (-> string number _ _) (lambda (name age) {:name name :age age}))`
    );
  });

  it.skip("should retain at-expressions", () => {
    prettySimilar(`@doc{This is simple annotation}`);
  });

  it("should print lambda abstractions beautifully", () => {
    expect(pprintSource("(lambda (aaa bbb ccc) xxx)")).toMatchSnapshot();
    expect(
      pprintSource(
        "(lambda (aaa bbb ccc ddd eee fff ggg hhh iii jjj kkk lll mmm nnn ooo ppp qqq) xxx)"
      )
    ).toMatchSnapshot();
    expect(
      pprintSource(
        "(lambda (aaa bbb ccc ddd eee fff ggg hhh iii jjj kkk lll mmm nnn ooo ppp qqq rrr sss ttt uuu vvv www xx) xxx)"
      )
    ).toMatchSnapshot();
  });

  it("shold print definitions beautifully", () => {
    expect(pprintSource("(define x 10)")).toMatchSnapshot();
    expect(
      pprintSource(
        "(define x (lambda (aaa bbb ccc ddd eee fff ggg hhh iii jjj kkk lll mmm nnn ooo ppp qqq rrr sss ttt uuu vvv www xx) xxx))"
      )
    ).toMatchSnapshot();
  });

  it("should align nested function calls", () => {
    expect(
      pprintSource(
        "(funcall aaaaa aaaaa aaaaa aaaaa aaaaa aaaaa aaaaa aaaaa (fxyz 000 111 222) aaaaa aaaaa aaaaa aaaaa aaaaa aaaaa aaaaa)"
      )
    ).toMatchSnapshot();

    expect(
      pprintSource("(funcall aaaaa aaaaa aaaaa (fxyz 000 111 222))")
    ).toMatchSnapshot();

    expect(
      pprintSource(
        "(funcall aaaaa aaaaa aaaaa (fxyz 000 111 222 333 444 555 666 777 888 999 aaa bbb xxx yyy zzz www uuu ttt))"
      )
    ).toMatchSnapshot();
  });

  it("should pretty print a combination of lambda and function call", () => {
    expect(
      pprintSource(
        "(foo (lambda (x y z) (funcall aaaaa aaaaa aaaaa (fxyz 000 111 222 333 444 555 666 777 888 999 aaa bbb xxx yyy zzz www uuu ttt))))"
      )
    ).toMatchSnapshot();
  });

  it("should print amll real code beautifully", () => {
    expect(
      pprintSource(
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
      pprintSource(
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
      pprintSource(`
(function-call-1 (function-call-2 (function-call-3 (function-call-4 (function-call-5 3
                                                                                     4
                                                                                     5
                                                                                     6
                                                                                     7))))
                 30)`)
    ).toMatchSnapshot();
  });

  it("should print no trailing space in empty function calls", () => {
    expect(pprintSource(`(f)`)).toBe("\n(f)");
  });

  it("should print let expressions nicely", () => {
    expect(pprintSource(`(let {x 10 y 20} (+ x y))`)).toMatchSnapshot();
  });

  it("should print conditional expressions nicely", () => {
    expect(pprintSource(`(if true 1 2)`)).toMatchSnapshot();
    expect(
      pprintSource(
        `(if aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa 1 2)`
      )
    ).toMatchSnapshot();
  });

  it("should print empty vectors", () => {
    expect(pprintSource(`[]`)).toMatchSnapshot();
  });

  it("should print empty records", () => {
    expect(pprintSource(`{}`)).toMatchSnapshot();
  });

  it("should print records with nested expressions", () => {
    expect(
      pprintSource(
        `{:xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx 20 :z (* 10 (+ 1 2))}`
      )
    ).toMatchSnapshot();
  });

  it("should print extended records", () => {
    expect(pprintSource(`{:foo 1 | bar}`)).toMatchSnapshot();
  });

  it("should some real code", () => {
    expect(
      pprintSource(
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
      pprintSource(
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
      pprintSource(
        `(type Person {:name string :age number :books [{:name string :author string}]}) `
      )
    ).toMatchSnapshot();
  });

  it("should pretty print type type applications", () => {
    expect(pprintSource(`(the (a) 10)`)).toMatchSnapshot();
  });

  it("should pretty print do blocks", () => {
    expect(
      pprintSource(`(do (print "hello") (print "bye bye!"))`)
    ).toMatchSnapshot();
  });

  it("should pretty print tag forms", () => {
    expect(pprintSource(`(case :version 0)`)).toMatchSnapshot();
  });

  it("should pretty print tag forms with large expressions", () => {
    expect(
      pprintSource(
        `(case :version this-is-a-extremely--long-and-annoying-variable-name-in-order-to-break-the-line)`
      )
    ).toMatchSnapshot();
  });

  it("should pretty match expressions", () => {
    expect(
      pprintSource(
        `
(match value
  ({:version number} number)
  ({:unrelesed _} number)
)`
      )
    ).toMatchSnapshot();
  });

  it("should break long bodies in match expressions", () => {
    expect(
      pprintSource(
        `
(match value
  ({:version number} (+ 1234 1234 1234 1234 1234 123 1234 1234 1234 1234 1234 1234 number))
  ({:unrelesed _} ()number)
)`
      )
    ).toMatchSnapshot();
  });
});

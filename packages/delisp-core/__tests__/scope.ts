import { readModule } from "../src/module";
import * as S from "../src/syntax";
import { resolveNamesInModule, Scoped } from "../src/syntax-scoped";

describe("Name resolution", () => {
  it("should provide all available global names", () => {
    const m = readModule(`
      (define pi 3.14)
      (define e "no clue")
      x
      `);

    const namedModule = resolveNamesInModule(m, []);

    const form = namedModule.body[namedModule.body.length - 1] as S.Expression<
      Scoped
    >;
    expect(form.info.variables).toEqual(["pi", "e"]);
  });

  it("should provide all let-defined variables", () => {
    const m = readModule(`
      (let {eps 0.01} foo)
      `);

    const namedModule = resolveNamesInModule(m, []);

    const form = namedModule.body[0] as S.SLet<Scoped>;
    expect(form.node.body[0].info.variables).toEqual(["eps"]);
  });

  it("should provide all lambda-defined parameters", () => {
    const m = readModule(`
      (lambda (x y) foo)
      `);

    const namedModule = resolveNamesInModule(m, []);

    const form = namedModule.body[0] as S.SFunction<Scoped>;
    expect(form.node.body[0].info.variables).toEqual(["x", "y"]);
  });

  it.skip("should provide all multiple-value-bind defined bindings", () => {
    const m = readModule(`
      (multiple-value-bind (x y) (values 1 2) "foo")`);
    const namedModule = resolveNamesInModule(m, []);
    const form = namedModule.body[0] as S.SMultipleValueBind<Scoped>;
    expect(form.node.body[0].info.variables).toEqual(["x", "y"]);
  });
});

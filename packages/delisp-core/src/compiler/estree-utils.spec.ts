import * as JS from "estree";
import { jsexpr } from "./estree-utils";

const literal = (value: any): any => ({ type: "Literal", value });

describe("JS AST Template literals", () => {
  test("should read basic expressions", () => {
    const ast = jsexpr`3`;
    expect(ast).toHaveProperty("type", "Literal");
    expect(ast).toHaveProperty("value", 3);
  });

  test("should replace expressions with placeholders", () => {
    const ast = jsexpr`x + ${{ type: "Literal", value: 3 }}`;
    expect(ast).toMatchObject({
      type: "BinaryExpression",
      left: {
        type: "Identifier",
        name: "x"
      },
      right: literal(3)
    });
  });

  test("should replace multiple expressions", () => {
    const ast = jsexpr`${literal(42)} + ${literal(24)}`;
    expect(ast).toMatchObject({
      type: "BinaryExpression",
      left: literal(42),
      right: literal(24)
    });
  });

  test("should replace placeholders inside argument list", () => {
    const ast = jsexpr`f(1, ${literal(42)})`;
    expect(ast).toMatchObject({
      type: "CallExpression",
      arguments: [{ type: "Literal", value: 1 }, { type: "Literal", value: 42 }]
    });
  });

  test("should replace placeholders inside argument list", () => {
    const ast = jsexpr`f(1, ${literal(42)})`;
    expect(ast).toMatchObject({
      type: "CallExpression",
      arguments: [{ type: "Literal", value: 1 }, { type: "Literal", value: 42 }]
    });
  });

  test("should spread placeholders with array values inside an argument list", () => {
    const args: JS.Expression[] = [literal(1), literal(42)];
    const ast = jsexpr`f(${args})`;
    expect(ast).toMatchObject({
      type: "CallExpression",
      arguments: [{ type: "Literal", value: 1 }, { type: "Literal", value: 42 }]
    });
  });
});

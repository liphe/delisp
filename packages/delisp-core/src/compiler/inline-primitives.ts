import * as JS from "estree";
import { range } from "../utils";

type InlineHandler = (args: JS.Expression[]) => JS.Expression;

interface InlinePrim {
  nargs: number;
  handle: InlineHandler;
}

const inlinefuncs = new Map<string, InlinePrim>();

function defineInlinePrimitive(
  name: string,
  nargs: number,
  handle: InlineHandler
) {
  return inlinefuncs.set(name, { nargs, handle });
}

export function isInlinePrimitive(name: string) {
  return inlinefuncs.has(name);
}

export function findInlinePrimitive(name: string): InlinePrim {
  const prim = inlinefuncs.get(name);
  if (!prim) {
    throw new Error(`${name} is not an primitive inline function call`);
  }
  return prim;
}

/** Compile a inline primitive with a set of parameters.
 *
 * @description If `position` is not a function call, a wrapper
 * function will be created so the inlined primitive can be used as a
 * function.
 *
 */
export function compileInlinePrimitive(
  name: string,
  args: JS.Expression[],
  position: "funcall" | "value"
): JS.Expression {
  const prim = findInlinePrimitive(name);
  if (position === "funcall" || prim.nargs === 0) {
    return prim.handle(args);
  } else {
    const identifiers = range(prim.nargs).map(
      (i): JS.Identifier => ({
        type: "Identifier",
        name: `x${i}`
      })
    );
    return {
      type: "ArrowFunctionExpression",
      params: identifiers,
      body: prim.handle(identifiers),
      expression: true
    };
  }
}

defineInlinePrimitive("true", 0, () => {
  return {
    type: "Literal",
    value: true
  };
});

defineInlinePrimitive("false", 0, () => {
  return {
    type: "Literal",
    value: false
  };
});

defineInlinePrimitive("+", 2, args => {
  return {
    type: "BinaryExpression",
    operator: "+",
    left: args[0],
    right: args[1]
  };
});

defineInlinePrimitive("*", 2, args => {
  return {
    type: "BinaryExpression",
    operator: "*",
    left: args[0],
    right: args[1]
  };
});

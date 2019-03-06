import * as JS from "estree";
import { readType } from "../type-utils";
import { Type } from "../types";
import { range } from "../utils";

type InlineHandler = (args: JS.Expression[]) => JS.Expression;

interface InlinePrim {
  type: Type;
  handle: InlineHandler;
}

const inlinefuncs = new Map<string, InlinePrim>();

export function getInlinePrimitiveTypes(): { [name: string]: Type } {
  return Array.from(inlinefuncs.entries()).reduce(
    (obj, [name, prim]) => ({ ...obj, [name]: prim.type }),
    {}
  );
}

function createInlinePrimitive(
  typespec: string,
  handle: InlineHandler
): InlinePrim {
  const type = readType(typespec);
  return { type, handle };
}

function defineInlinePrimitive(
  name: string,
  typespec: string,
  handle: InlineHandler
) {
  return inlinefuncs.set(name, createInlinePrimitive(typespec, handle));
}

export function isInlinePrimitive(name: string) {
  return name[0] === "." || inlinefuncs.has(name);
}

export function findInlinePrimitive(name: string): InlinePrim {
  if (name[0] === ".") {
    const label = name.slice(1);
    return createInlinePrimitive(`(-> {${label} a} a)`, ([vec]) => ({
      type: "MemberExpression",
      computed: true,
      object: vec,
      property: { type: "Identifier", name: label }
    }));
  } else {
    const prim = inlinefuncs.get(name);
    if (!prim) {
      throw new Error(`${name} is not an primitive inline function call`);
    }
    return prim;
  }
}

function primitiveArity(prim: InlinePrim): number {
  const type = prim.type.mono;
  if (type.type === "application" && type.op === "->") {
    return type.args.length - 1;
  } else {
    return 0;
  }
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
  const arity = primitiveArity(prim);

  if (position === "funcall" || arity === 0) {
    return prim.handle(args);
  } else {
    const identifiers = range(arity).map(
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

//
// Helpers
//

function methodCall(
  e: JS.Expression,
  method: string,
  args: JS.Expression[]
): JS.Expression {
  return {
    type: "CallExpression",
    callee: {
      type: "MemberExpression",
      object: e,
      property: { type: "Identifier", name: method },
      computed: false
    },
    arguments: args
  };
}

//
// Primitives
//

defineInlinePrimitive("true", "boolean", () => {
  return {
    type: "Literal",
    value: true
  };
});

defineInlinePrimitive("false", "boolean", () => {
  return {
    type: "Literal",
    value: false
  };
});

defineInlinePrimitive("print", "(-> string void)", args => {
  return methodCall({ type: "Identifier", name: "console" }, "log", args);
});

defineInlinePrimitive("+", "(-> number number number)", args => {
  return {
    type: "BinaryExpression",
    operator: "+",
    left: args[0],
    right: args[1]
  };
});

defineInlinePrimitive("*", "(-> number number number)", args => {
  return {
    type: "BinaryExpression",
    operator: "*",
    left: args[0],
    right: args[1]
  };
});

defineInlinePrimitive("map", "(-> (-> a b) [a] [b])", ([fn, vec]) => {
  return methodCall(vec, "map", [fn]);
});

defineInlinePrimitive(
  "filter",
  "(-> (-> a boolean) [a] [a])",
  ([predicate, vec]) => {
    return methodCall(vec, "filter", [predicate]);
  }
);

defineInlinePrimitive("fold", "(-> (-> b a b) [a] b b)", ([fn, vec, init]) => {
  return methodCall(vec, "reduce", [fn, init]);
});

defineInlinePrimitive("append", "(-> [a] [a] [a])", ([vec1, vec2]) => {
  return methodCall(vec1, "concat", [vec2]);
});

defineInlinePrimitive("reverse", "(-> [a] [a])", ([vec]) => {
  return methodCall(methodCall(vec, "slice", []), "reverse", []);
});

defineInlinePrimitive("length", "(-> [a] number)", ([vec]) => {
  return {
    type: "MemberExpression",
    computed: false,
    object: vec,
    property: { type: "Identifier", name: "length" }
  };
});

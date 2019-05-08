import * as JS from "estree";
import { InvariantViolation } from "../invariant";
import { generateUniqueTVar } from "../type-generate";
import { isFunctionType, generalize, readType } from "../type-utils";
import { tFn, tRecord, TypeSchema } from "../types";
import { range } from "../utils";
import { member, methodCall } from "./estree-utils";

type InlineHandler = (args: JS.Expression[]) => JS.Expression;

interface InlinePrim {
  type: TypeSchema;
  handle: InlineHandler;
}

interface MagicPrim {
  matches: (name: string) => boolean;
  createPrimitive: (name: string) => InlinePrim;
}
const inlinefuncs = new Map<string, InlinePrim>();
const magicfuncs: MagicPrim[] = [];

function createInlinePrimitive(
  typespec: string | TypeSchema,
  handle: InlineHandler
): InlinePrim {
  const type = typeof typespec === "string" ? readType(typespec) : typespec;
  return { type, handle };
}

function defineInlinePrimitive(
  name: string,
  typespec: string,
  handle: InlineHandler
) {
  return inlinefuncs.set(name, createInlinePrimitive(typespec, handle));
}

function defineMagicPrimitive(
  matches: MagicPrim["matches"],
  createPrimitive: MagicPrim["createPrimitive"]
) {
  magicfuncs.push({ matches, createPrimitive });
}

export function isInlinePrimitive(name: string) {
  return inlinefuncs.has(name) || magicfuncs.some(f => f.matches(name));
}

export function findInlinePrimitive(name: string): InlinePrim {
  const prim = inlinefuncs.get(name);
  if (prim) {
    return prim;
  }

  const magicPrim = magicfuncs.find(f => f.matches(name));
  if (magicPrim) {
    return magicPrim.createPrimitive(name);
  }

  throw new InvariantViolation(
    `${name} is not an primitive inline function call`
  );
}

function primitiveArity(prim: InlinePrim): number {
  const type = prim.type.mono;
  if (isFunctionType(type)) {
    return type.node.args.length - 2;
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

defineInlinePrimitive("print", "(-> string (effect console) void)", args => {
  return methodCall({ type: "Identifier", name: "console" }, "log", args);
});

defineInlinePrimitive("+", "(-> number number _ number)", args => {
  return {
    type: "BinaryExpression",
    operator: "+",
    left: args[0],
    right: args[1]
  };
});

defineInlinePrimitive("-", "(-> number number _ number)", args => {
  return {
    type: "BinaryExpression",
    operator: "-",
    left: args[0],
    right: args[1]
  };
});

defineInlinePrimitive("*", "(-> number number _ number)", args => {
  return {
    type: "BinaryExpression",
    operator: "*",
    left: args[0],
    right: args[1]
  };
});

defineInlinePrimitive("map", "(-> (-> a e b) [a] e [b])", ([fn, vec]) => {
  return methodCall(vec, "map", [fn]);
});

defineInlinePrimitive(
  "filter",
  "(-> (-> a _ boolean) [a] _ [a])",
  ([predicate, vec]) => {
    return methodCall(vec, "filter", [predicate]);
  }
);

defineInlinePrimitive(
  "fold",
  "(-> (-> b a _ b) [a] b _ b)",
  ([fn, vec, init]) => {
    return methodCall(vec, "reduce", [fn, init]);
  }
);

defineInlinePrimitive("append", "(-> [a] [a] _ [a])", ([vec1, vec2]) => {
  return methodCall(vec1, "concat", [vec2]);
});

defineInlinePrimitive("reverse", "(-> [a] _ [a])", ([vec]) => {
  return methodCall(methodCall(vec, "slice", []), "reverse", []);
});

defineInlinePrimitive("length", "(-> [a] _ number)", ([vec]) =>
  member(vec, "length")
);

defineInlinePrimitive("=", "(-> number number _ boolean)", ([x, y]) => ({
  type: "BinaryExpression",
  operator: "===",
  left: x,
  right: y
}));

defineInlinePrimitive("zero?", "(-> number _ boolean)", ([x]) => ({
  type: "BinaryExpression",
  operator: "===",
  left: x,
  right: { type: "Literal", value: 0 }
}));

defineInlinePrimitive("string=", "(-> string string _ boolean)", ([x, y]) => ({
  type: "BinaryExpression",
  operator: "===",
  left: x,
  right: y
}));

defineInlinePrimitive("string-length", "(-> string _ number)", ([str]) =>
  member(str, "length")
);

defineInlinePrimitive("string-upcase", "(-> string _ string)", ([str]) =>
  methodCall(str, "toUpperCase", [])
);

defineInlinePrimitive("string-downcase", "(-> string _ string)", ([str]) =>
  methodCall(str, "toLowerCase", [])
);

defineInlinePrimitive(
  "string-append",
  "(-> string string _ string)",
  ([str1, str2]) => {
    return {
      type: "BinaryExpression",
      operator: "+",
      left: str1,
      right: str2
    };
  }
);

// matches `.foo` and inlines `(-> {foo a | b} a)`
defineMagicPrimitive(
  name => name[0] === ":" && name.length > 1,
  name => {
    const a = generateUniqueTVar();
    const r = generateUniqueTVar();
    const jsname = name.replace(/^:/, "");
    const t = generalize(
      tFn([tRecord([{ label: name, type: a }], r)], generateUniqueTVar(), a),
      []
    );
    return createInlinePrimitive(t, ([vec]) => member(vec, jsname));
  }
);

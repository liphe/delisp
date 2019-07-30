import * as JS from "estree";
import { readType } from "../type-convert";
import { InvariantViolation } from "../invariant";
import { isFunctionType, typeArity } from "../type-utils";
import * as T from "../types";
import {
  identifier,
  literal,
  member,
  methodCall,
  awaitExpr,
  op1,
  op,
  primitiveCall
} from "./estree-utils";

type InlineHandler = (args: JS.Expression[]) => JS.Expression;

interface InlinePrim {
  type: T.TypeSchema;
  // The number of arguments the inline primitive takes
  arity: number;
  // This handler is invoked to generate the output JS when the
  // primitive is used in function position.
  funcHandler: InlineHandler;
}

const inlinefuncs = new Map<string, InlinePrim>();

function defineInlinePrimitive(
  name: string,
  typespec: string,
  funcHandler: InlineHandler
) {
  const type = readType(typespec);
  if (!isFunctionType(type.mono)) {
    throw new Error(
      `Inline primitives must be functions, but the primitive "${name}" was declared with type "${typespec}".`
    );
  }
  const arity = typeArity(type.mono);
  const prim: InlinePrim = { type, arity, funcHandler };
  inlinefuncs.set(name, prim);
}

export function isInlinePrimitive(name: string) {
  return inlinefuncs.has(name);
}

export function findInlinePrimitive(name: string): InlinePrim {
  const prim = inlinefuncs.get(name);
  if (prim) {
    return prim;
  } else {
    throw new InvariantViolation(
      `${name} is not an primitive inline function call`
    );
  }
}

//
// Primitives
//

defineInlinePrimitive(
  "not",
  "(-> _ctx boolean (effect) boolean)",
  ([_ctx, x]) => op1("!", x)
);

defineInlinePrimitive(
  "and",
  "(-> _ctx boolean boolean (effect) boolean)",
  ([_ctx, left, right]) => ({
    type: "LogicalExpression",
    operator: "&&",
    left,
    right
  })
);

defineInlinePrimitive(
  "or",
  "(-> _ctx boolean boolean (effect) boolean)",
  ([_ctx, left, right]) => ({
    type: "LogicalExpression",
    operator: "||",
    left,
    right
  })
);

defineInlinePrimitive(
  "print",
  "(-> _ctx string (effect console) none)",
  ([_ctx, ...args]) => {
    return methodCall(identifier("console"), "log", args);
  }
);

defineInlinePrimitive(
  "+",
  "(-> _ctx number number (effect) number)",
  ([_ctx, ...args]) => op("+", args[0], args[1])
);

defineInlinePrimitive(
  "-",
  "(-> _ctx number number (effect) number)",
  ([_ctx, ...args]) => op("-", args[0], args[1])
);

defineInlinePrimitive(
  "*",
  "(-> _ctx number number (effect) number)",
  ([_ctx, ...args]) => op("*", args[0], args[1])
);

defineInlinePrimitive(
  "map",
  "(-> _ctx (-> _ctx a e (values b <| _)) [a] e [b])",
  ([ctx, fn, vec]) => {
    return awaitExpr(
      primitiveCall(
        "promiseMap",
        vec,
        primitiveCall("bindPrimaryValue", fn, ctx)
      )
    );
  }
);

defineInlinePrimitive(
  "filter",
  "(-> _ctx (-> _ctx a _ (values boolean <| _)) [a] _ [a])",
  ([ctx, predicate, vec]) => {
    return awaitExpr(
      primitiveCall(
        "promiseFilter",
        vec,
        primitiveCall("bindPrimaryValue", predicate, ctx)
      )
    );
  }
);

defineInlinePrimitive(
  "fold",
  "(-> _ctx (-> _ctx b a _ (values b <| _)) [a] b _ b)",
  ([ctx, fn, vec, init]) => {
    return awaitExpr(
      primitiveCall(
        "promiseReduce",
        vec,
        primitiveCall("bindPrimaryValue", fn, ctx),
        init
      )
    );
  }
);

defineInlinePrimitive(
  "append",
  "(-> _ctx [a] [a] (effect) [a])",
  ([_ctx, vec1, vec2]) => {
    return methodCall(vec1, "concat", [vec2]);
  }
);

defineInlinePrimitive(
  "reverse",
  "(-> _ctx [a] (effect) [a])",
  ([_ctx, vec]) => {
    return methodCall(methodCall(vec, "slice", []), "reverse", []);
  }
);

defineInlinePrimitive(
  "length",
  "(-> _ctx [a] (effect) number)",
  ([_ctx, vec]) => member(vec, "length")
);

defineInlinePrimitive(
  "=",
  "(-> _ctx number number (effect) boolean)",
  ([_ctx, x, y]) => op("===", x, y)
);

defineInlinePrimitive(
  "zero?",
  "(-> _ctx number (effect) boolean)",
  ([_ctx, x]) => op("===", x, literal(0))
);

defineInlinePrimitive(
  "<=",
  "(-> _ctx number number (effect) boolean)",
  ([_ctx, x, y]) => op("<=", x, y)
);

defineInlinePrimitive(
  "<",
  "(-> _ctx number number (effect) boolean)",
  ([_ctx, x, y]) => op("<", x, y)
);

defineInlinePrimitive(
  ">",
  "(-> _ctx number number (effect) boolean)",
  ([_ctx, x, y]) => op(">", x, y)
);

defineInlinePrimitive(
  ">=",
  "(-> _ctx number number (effect) boolean)",
  ([_ctx, x, y]) => op(">=", x, y)
);

defineInlinePrimitive(
  "string=",
  "(-> _ctx string string (effect) boolean)",
  ([_ctx, x, y]) => op("===", x, y)
);

defineInlinePrimitive(
  "string-length",
  "(-> _ctx string (effect) number)",
  ([_ctx, str]) => member(str, "length")
);

defineInlinePrimitive(
  "string-upcase",
  "(-> _ctx string (effect) string)",
  ([_ctx, str]) => methodCall(str, "toUpperCase", [])
);

defineInlinePrimitive(
  "string-downcase",
  "(-> _ctx string (effect) string)",
  ([_ctx, str]) => methodCall(str, "toLowerCase", [])
);

defineInlinePrimitive(
  "string-append",
  "(-> _ctx string string (effect) string)",
  ([_ctx, str1, str2]) => op("+", str1, str2)
);

// Tuples

defineInlinePrimitive(
  "pair",
  "(-> _ctx a b (effect) (* a b))",
  ([_ctx, a, b]) => {
    return primitiveCall("primPair", a, b);
  }
);

defineInlinePrimitive(
  "%fst",
  "(-> _ctx (* a b) (effect) a)",
  ([_ctx, pair]) => {
    return primitiveCall("primFst", pair);
  }
);

defineInlinePrimitive(
  "%snd",
  "(-> _ctx (* a b) (effect) b)",
  ([_ctx, pair]) => {
    return primitiveCall("primSnd", pair);
  }
);

defineInlinePrimitive(
  "assert",
  "(-> _ctx boolean string (effect exp) none)",
  ([_ctx, x, msg]) => {
    return primitiveCall("assert", x, msg);
  }
);

//
// Vectors
//

defineInlinePrimitive(
  "cons",
  "(-> _ctx a [a] (effect) [a])",
  ([_ctx, x, lst]) => ({
    type: "ArrayExpression",
    elements: [x, { type: "SpreadElement", argument: lst }]
  })
);

defineInlinePrimitive(
  "empty?",
  "(-> _ctx [a] (effect) boolean)",
  ([_ctx, lst]) => op("===", member(lst, "length"), literal(0))
);

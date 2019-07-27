import * as JS from "estree";
import { readType } from "../type-convert";
import { InvariantViolation } from "../invariant";
import { generateUniqueTVar } from "../type-generate";
import { type } from "../type-tag";
import { generalize, isFunctionType } from "../type-utils";
import * as T from "../types";
import { range } from "../utils";
import {
  arrowFunction,
  identifier,
  literal,
  member,
  methodCall,
  objectExpression,
  op1,
  op,
  primitiveCall
} from "./estree-utils";

type InlineHandler = (args: JS.Expression[]) => JS.Expression;

interface InlinePrim {
  type: T.TypeSchema;
  // This handler is invoked to generate the output JS when the
  // primitive is used in value position.
  valueHandler: InlineHandler;
  // This handler is invoked to generate the output JS when the
  // primitive is used in function position.
  funcHandler: InlineHandler;
}

interface MagicPrim {
  matches: (name: string) => boolean;
  createPrimitive: (name: string) => InlinePrim;
}
const inlinefuncs = new Map<string, InlinePrim>();
const magicfuncs: MagicPrim[] = [];

function createInlinePrimitive(
  name: string,
  type: T.TypeSchema,
  valueHandler: InlineHandler,
  funcHandler: InlineHandler
) {
  const prim: InlinePrim = { type, valueHandler, funcHandler };
  return inlinefuncs.set(name, prim);
}

function definePrimitiveValue(
  name: string,
  typespec: string,
  handle: InlineHandler
) {
  const type = readType(typespec);
  return createInlinePrimitive(name, type, handle, handle);
}

function defineInlinePrimitive(
  name: string,
  typespec: string,
  handle: InlineHandler
) {
  const type = readType(typespec);
  const arity = typeArity(type.mono);

  /* If the primitive is used in a value position, a wrapper function
     will be created so the inlined primitive can be used as a
     function. */
  const valueHandler: InlineHandler = () => {
    const identifiers = range(arity).map(i => identifier(`x${i}`));
    const identifiersAndContext = [identifier("*context*"), ...identifiers];
    return {
      type: "ArrowFunctionExpression",
      params: [identifier("values"), ...identifiersAndContext],
      body: handle(identifiersAndContext),
      expression: true
    };
  };

  createInlinePrimitive(name, type, valueHandler, handle);
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

function typeArity(type: T.Type): number {
  if (isFunctionType(type)) {
    // A type signature has 3 more elements than the arity of the
    // function:
    //    (-> context arg1 arg2 effect output)
    //
    // - context
    // - effect
    // - output
    return type.node.args.length - 3;
  } else {
    return 0;
  }
}

//
// Primitives
//

defineInlinePrimitive("not", "(-> _ctx boolean _ boolean)", ([_ctx, x]) =>
  op1("!", x)
);

defineInlinePrimitive(
  "and",
  "(-> _ctx boolean boolean _ boolean)",
  ([_ctx, left, right]) => ({
    type: "LogicalExpression",
    operator: "&&",
    left,
    right
  })
);

defineInlinePrimitive(
  "or",
  "(-> _ctx boolean bolean _ boolean)",
  ([_ctx, left, right]) => ({
    type: "LogicalExpression",
    operator: "||",
    left,
    right
  })
);

definePrimitiveValue("none", "none", () => {
  return identifier("undefined");
});

defineInlinePrimitive(
  "print",
  "(-> _ctx string (effect console | _) none)",
  ([_ctx, ...args]) => {
    return methodCall(identifier("console"), "log", args);
  }
);

defineInlinePrimitive(
  "+",
  "(-> _ctx number number _ number)",
  ([_ctx, ...args]) => op("+", args[0], args[1])
);

defineInlinePrimitive(
  "-",
  "(-> _ctx number number _ number)",
  ([_ctx, ...args]) => op("-", args[0], args[1])
);

defineInlinePrimitive(
  "*",
  "(-> _ctx number number _ number)",
  ([_ctx, ...args]) => op("*", args[0], args[1])
);

defineInlinePrimitive(
  "map",
  "(-> _ctx (-> _ctx a e (values b | _)) [a] e [b])",
  ([ctx, fn, vec]) => {
    return methodCall(vec, "map", [primitiveCall("bindPrimaryValue", fn, ctx)]);
  }
);

defineInlinePrimitive(
  "filter",
  "(-> _ctx (-> _ctx a _ (values boolean | _)) [a] _ [a])",
  ([ctx, predicate, vec]) => {
    return methodCall(vec, "filter", [
      primitiveCall("bindPrimaryValue", predicate, ctx)
    ]);
  }
);

defineInlinePrimitive(
  "fold",
  "(-> _ctx (-> _ctx b a _ (values b | _)) [a] b _ b)",
  ([ctx, fn, vec, init]) => {
    return methodCall(vec, "reduce", [
      primitiveCall("bindPrimaryValue", fn, ctx),
      init
    ]);
  }
);

defineInlinePrimitive(
  "append",
  "(-> _ctx [a] [a] _ [a])",
  ([_ctx, vec1, vec2]) => {
    return methodCall(vec1, "concat", [vec2]);
  }
);

defineInlinePrimitive("reverse", "(-> _ctx [a] _ [a])", ([_ctx, vec]) => {
  return methodCall(methodCall(vec, "slice", []), "reverse", []);
});

defineInlinePrimitive("length", "(-> _ctx [a] _ number)", ([_ctx, vec]) =>
  member(vec, "length")
);

defineInlinePrimitive(
  "=",
  "(-> _ctx number number _ boolean)",
  ([_ctx, x, y]) => op("===", x, y)
);

defineInlinePrimitive("zero?", "(-> _ctx number _ boolean)", ([_ctx, x]) =>
  op("===", x, literal(0))
);

defineInlinePrimitive(
  "<=",
  "(-> _ctx number number _ boolean)",
  ([_ctx, x, y]) => op("<=", x, y)
);

defineInlinePrimitive(
  "<",
  "(-> _ctx number number _ boolean)",
  ([_ctx, x, y]) => op("<", x, y)
);

defineInlinePrimitive(
  ">",
  "(-> _ctx number number _ boolean)",
  ([_ctx, x, y]) => op(">", x, y)
);

defineInlinePrimitive(
  ">=",
  "(-> _ctx number number _ boolean)",
  ([_ctx, x, y]) => op(">=", x, y)
);

defineInlinePrimitive(
  "string=",
  "(-> _ctx string string _ boolean)",
  ([_ctx, x, y]) => op("===", x, y)
);

defineInlinePrimitive(
  "string-length",
  "(-> _ctx string _ number)",
  ([_ctx, str]) => member(str, "length")
);

defineInlinePrimitive(
  "string-upcase",
  "(-> _ctx string _ string)",
  ([_ctx, str]) => methodCall(str, "toUpperCase", [])
);

defineInlinePrimitive(
  "string-downcase",
  "(-> _ctx string _ string)",
  ([_ctx, str]) => methodCall(str, "toLowerCase", [])
);

defineInlinePrimitive(
  "string-append",
  "(-> _ctx string string _ string)",
  ([_ctx, str1, str2]) => op("+", str1, str2)
);

// Tuples

defineInlinePrimitive("pair", "(-> _ctx a b _ (* a b))", ([_ctx, a, b]) => {
  return primitiveCall("primPair", a, b);
});

defineInlinePrimitive("%fst", "(-> _ctx (* a b) _ a)", ([_ctx, pair]) => {
  return primitiveCall("primFst", pair);
});

defineInlinePrimitive("%snd", "(-> _ctx (* a b) _ b)", ([_ctx, pair]) => {
  return primitiveCall("primSnd", pair);
});

defineInlinePrimitive(
  "assert",
  "(-> _ctx boolean string (effect exp | _) none)",
  ([_ctx, x, msg]) => {
    return primitiveCall("assert", x, msg);
  }
);

//
// Vectors
//

defineInlinePrimitive("cons", "(-> _ctx a [a] _ [a])", ([_ctx, x, lst]) => ({
  type: "ArrayExpression",
  elements: [x, { type: "SpreadElement", argument: lst }]
}));

defineInlinePrimitive("empty?", "(-> _ctx [a] _ boolean)", ([_ctx, lst]) =>
  op("===", member(lst, "length"), literal(0))
);

/*
matches `:foo` and inlines the lens with type

  (-> a _ (values b (-> c d)))

*/
defineMagicPrimitive(
  name => name[0] === ":" && name.length > 1,
  name => {
    const fieldType = generateUniqueTVar();
    const newFieldType = generateUniqueTVar();

    const extendsType = generateUniqueTVar();
    const recordType = T.record(
      [{ label: name, type: fieldType }],
      extendsType
    );
    const newRecordType = T.record(
      [{ label: name, type: newFieldType }],
      extendsType
    );

    const lensType = generalize(
      type`(-> _ctx1 ${recordType}
               _
               (values ${fieldType}
                       (-> _ctx2 ${newFieldType} _ ${newRecordType})))`,
      []
    );

    const jsname = name.replace(/^:/, "");

    const handler = () =>
      arrowFunction(
        [identifier("values"), identifier("*context*"), identifier("obj")],
        [
          primitiveCall(
            "values",
            member(identifier("obj"), jsname),
            arrowFunction(
              [
                identifier("values"),
                identifier("*context*"),
                identifier("val")
              ],
              [
                methodCall(identifier("Object"), "assign", [
                  objectExpression([]),
                  identifier("obj"),
                  objectExpression([
                    {
                      key: jsname,
                      value: identifier("val")
                    }
                  ])
                ])
              ]
            )
          )
        ]
      );

    return {
      type: lensType,
      valueHandler: handler,
      funcHandler: args => ({
        type: "CallExpression",
        callee: handler(),
        arguments: [identifier("values"), ...args]
      })
    };
  }
);

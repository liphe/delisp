import * as JS from "estree";
import { InvariantViolation } from "../invariant";
import { generateUniqueTVar } from "../type-generate";
import { readType } from "../convert-type";
import { isFunctionType, generalize } from "../type-utils";
import { type } from "../type-tag";
import { tRecord, TypeSchema, Type } from "../types";
import { range } from "../utils";
import {
  op,
  member,
  methodCall,
  arrowFunction,
  identifier,
  literal,
  primitiveCall,
  objectExpression
} from "./estree-utils";

type InlineHandler = (args: JS.Expression[]) => JS.Expression;

interface InlinePrim {
  type: TypeSchema;
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
  type: TypeSchema,
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
    return {
      type: "ArrowFunctionExpression",
      params: [identifier("values"), ...identifiers],
      body: handle(identifiers),
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

function typeArity(type: Type): number {
  if (isFunctionType(type)) {
    return type.node.args.length - 2;
  } else {
    return 0;
  }
}

/** Compile a inline primitive with a set of parameters.
 *
 *
 */
export function compileInlinePrimitive(
  name: string,
  args: JS.Expression[],
  position: "funcall" | "value"
): JS.Expression {
  const prim = findInlinePrimitive(name);
  if (position === "funcall") {
    return prim.funcHandler(args);
  } else {
    return prim.valueHandler(args);
  }
}

//
// Primitives
//

definePrimitiveValue("true", "boolean", () => {
  return literal(true);
});

definePrimitiveValue("false", "boolean", () => {
  return literal(false);
});

definePrimitiveValue("none", "none", () => {
  return identifier("undefined");
});

defineInlinePrimitive(
  "print",
  "(-> string (effect console | _) none)",
  args => {
    return methodCall(identifier("console"), "log", args);
  }
);

defineInlinePrimitive("+", "(-> number number _ number)", args =>
  op("+", args[0], args[1])
);

defineInlinePrimitive("-", "(-> number number _ number)", args =>
  op("-", args[0], args[1])
);

defineInlinePrimitive("*", "(-> number number _ number)", args =>
  op("*", args[0], args[1])
);

defineInlinePrimitive(
  "map",
  "(-> (-> a e (values b | _)) [a] e [b])",
  ([fn, vec]) => {
    return methodCall(vec, "map", [primitiveCall("bindPrimaryValue", fn)]);
  }
);

defineInlinePrimitive(
  "filter",
  "(-> (-> a _ (values boolean | _)) [a] _ [a])",
  ([predicate, vec]) => {
    return methodCall(vec, "filter", [
      primitiveCall("bindPrimaryValue", predicate)
    ]);
  }
);

defineInlinePrimitive(
  "fold",
  "(-> (-> b a _ (values b | _)) [a] b _ b)",
  ([fn, vec, init]) => {
    return methodCall(vec, "reduce", [
      primitiveCall("bindPrimaryValue", fn),
      init
    ]);
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

defineInlinePrimitive("=", "(-> number number _ boolean)", ([x, y]) =>
  op("===", x, y)
);

defineInlinePrimitive("zero?", "(-> number _ boolean)", ([x]) =>
  op("===", x, literal(0))
);

defineInlinePrimitive("string=", "(-> string string _ boolean)", ([x, y]) =>
  op("===", x, y)
);

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
  ([str1, str2]) => op("+", str1, str2)
);

// Tuples

defineInlinePrimitive("pair", "(-> a b _ (* a b))", ([a, b]) => {
  return primitiveCall("primPair", a, b);
});

defineInlinePrimitive("%fst", "(-> (* a b) _ a)", ([pair]) => {
  return primitiveCall("primFst", pair);
});

defineInlinePrimitive("%snd", "(-> (* a b) _ b)", ([pair]) => {
  return primitiveCall("primtSnd", pair);
});

defineInlinePrimitive(
  "assert",
  "(-> boolean string (effect exp | _) none)",
  ([x, msg]) => {
    return primitiveCall("assert", x, msg);
  }
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
    const recordType = tRecord([{ label: name, type: fieldType }], extendsType);
    const newRecordType = tRecord(
      [{ label: name, type: newFieldType }],
      extendsType
    );

    const lensType = generalize(
      type`(-> ${recordType} 
               _ 
               (values ${fieldType} 
                       (-> ${newFieldType} _ ${newRecordType})))`,
      []
    );

    const jsname = name.replace(/^:/, "");

    const handler = () =>
      arrowFunction(
        [identifier("values"), identifier("obj")],
        [
          primitiveCall(
            "values",
            member(identifier("obj"), jsname),
            arrowFunction(
              [identifier("values"), identifier("val")],
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

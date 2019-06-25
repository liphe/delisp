import * as JS from "estree";
import { InvariantViolation } from "../invariant";
import { generateUniqueTVar } from "../type-generate";
import { readType } from "../convert-type";
import { isFunctionType, generalize } from "../type-utils";
import { tFn, tRecord, TypeSchema } from "../types";
import { range } from "../utils";
import {
  member,
  methodCall,
  arrowFunction,
  identifier,
  literal,
  primitiveCall
} from "./estree-utils";
import { isValidJSIdentifierName } from "./jsvariable";

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
      params: [identifier("values"), ...identifiers],
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

defineInlinePrimitive("none", "none", () => {
  return {
    type: "Identifier",
    name: "undefined"
  };
});

defineInlinePrimitive(
  "print",
  "(-> string (effect console | _) none)",
  args => {
    return methodCall({ type: "Identifier", name: "console" }, "log", args);
  }
);

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
  return methodCall(vec, "map", [primitiveCall("bindPrimaryValue", fn)]);
});

defineInlinePrimitive(
  "filter",
  "(-> (-> a _ boolean) [a] _ [a])",
  ([predicate, vec]) => {
    return methodCall(vec, "filter", [
      primitiveCall("bindPrimaryValue", predicate)
    ]);
  }
);

defineInlinePrimitive(
  "fold",
  "(-> (-> b a _ b) [a] b _ b)",
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
  "get",
  "(-> {:get (-> r e v) | l} r e v)",
  ([lens, obj]) => methodCall(lens, "get", [obj])
);

defineInlinePrimitive(
  "set",
  "(-> {:set (-> v r1 e r2) | l} v r1 e r2)",
  ([lens, val, obj]) => methodCall(lens, "set", [val, obj])
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

// Tuples

defineInlinePrimitive("pair", "(-> a b _ (* a b))", ([a, b]) => {
  return primitiveCall("pair", a, b);
});

defineInlinePrimitive("fst", "(-> (* a b) _ a)", ([pair]) => {
  return primitiveCall("fst", pair);
});

defineInlinePrimitive("snd", "(-> (* a b) _ b)", ([pair]) => {
  return primitiveCall("snd", pair);
});

/*
matches `:foo` and inlines lens
  {
    :get (-> {:foo a | b} _ a)
    :set (-> {:foo a | b} a _ {:foo a | b})
  }
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

    const getterType = tFn([recordType], generateUniqueTVar(), fieldType);
    const setterType = tFn(
      [newFieldType, recordType],
      generateUniqueTVar(),
      newRecordType
    );
    const lensType = generalize(
      tRecord([
        { label: ":get", type: getterType },
        { label: ":set", type: setterType }
      ]),
      []
    );
    const jsname = name.replace(/^:/, "");
    const getter = arrowFunction(
      ["obj"],
      member({ type: "Identifier", name: "obj" }, jsname)
    );
    const setter = arrowFunction(
      ["val", "obj"],
      methodCall({ type: "Identifier", name: "Object" }, "assign", [
        { type: "ObjectExpression", properties: [] },
        { type: "Identifier", name: "obj" },
        {
          type: "ObjectExpression",
          properties: [
            {
              type: "Property",
              key: isValidJSIdentifierName(jsname)
                ? identifier(jsname)
                : literal(jsname),
              value: identifier("val"),
              kind: "init",
              method: false,
              shorthand: false,
              computed: false
            }
          ]
        }
      ])
    );
    return createInlinePrimitive(lensType, () => ({
      type: "ObjectExpression",
      properties: [
        {
          type: "Property",
          key: { type: "Literal", value: "get" },
          value: getter,
          computed: false,
          kind: "init",
          method: false,
          shorthand: false
        },
        {
          type: "Property",
          key: { type: "Literal", value: "set" },
          value: setter,
          computed: false,
          kind: "init",
          method: false,
          shorthand: false
        }
      ]
    }));
  }
);

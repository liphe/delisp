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

function defineInlinePrimitive(
  name: string,
  typespec: string,
  handle: InlineHandler
) {
  const type = readType(typespec);
  return inlinefuncs.set(name, { type, handle });
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
  return {
    type: "CallExpression",
    callee: {
      type: "MemberExpression",
      object: { type: "Identifier", name: "console" },
      property: { type: "Identifier", name: "log" },
      computed: false
    },
    arguments: args
  };
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

defineInlinePrimitive(
  "map",
  "(-> (-> a b) (vector a) (vector b))",
  ([fn, vec]) => {
    return {
      type: "CallExpression",
      callee: {
        type: "MemberExpression",
        computed: false,
        object: vec,
        property: {
          type: "Identifier",
          name: "map"
        }
      },
      arguments: [fn]
    };
  }
);

defineInlinePrimitive(
  "filter",
  "(-> (-> a boolean) (vector a) (vector a))",
  ([predicate, vec]) => {
    return {
      type: "CallExpression",
      callee: {
        type: "MemberExpression",
        computed: false,
        object: vec,
        property: {
          type: "Identifier",
          name: "filter"
        }
      },
      arguments: [predicate]
    };
  }
);

defineInlinePrimitive(
  "fold",
  "(-> (-> b a b) (vector a) b b)",
  ([fn, vec, init]) => {
    return {
      type: "CallExpression",
      callee: {
        type: "MemberExpression",
        computed: false,
        object: vec,
        property: {
          type: "Identifier",
          name: "reduce"
        }
      },
      arguments: [fn, init]
    };
  }
);

defineInlinePrimitive(
  "append",
  "(-> (vector a) (vector a) (vector a))",
  ([vec1, vec2]) => {
    return {
      type: "CallExpression",
      callee: {
        type: "MemberExpression",
        computed: false,
        object: vec1,
        property: {
          type: "Identifier",
          name: "concat"
        }
      },
      arguments: [vec2]
    };
  }
);

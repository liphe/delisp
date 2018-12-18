import {
  Expression,
  Module,
  SDefinition,
  SFunction,
  SFunctionCall,
  SLet,
  SVariableReference,
  Syntax
} from "./syntax";

import { varnameToJS } from "./compiler/jsvariable";
import { pprint } from "./printer";

import * as recast from "recast";

import createDebug from "debug";
const debug = createDebug("delisp:compiler");

type JSAST = object;
interface Environment {
  [symbol: string]: string;
}

// Convert a Delisp variable name to Javascript. This function should
// be injective so there is no collisions and the output should be a
// valid variable name.

function compileLambda(fn: SFunction, env: Environment): JSAST {
  const newEnv = fn.lambdaList.reduce(
    (e, param) => ({
      ...e,
      [param.variable]: varnameToJS(param.variable)
    }),
    env
  );
  return {
    type: "ArrowFunctionExpression",
    params: fn.lambdaList.map(param => ({
      type: "Identifier",
      name: newEnv[param.variable]
    })),
    body: compile(fn.body, newEnv)
  };
}

function compileDefinition(def: SDefinition, env: Environment): JSAST {
  return {
    type: "AssignmentExpression",
    operator: "=",
    left: {
      type: "MemberExpression",
      computed: true,
      object: {
        type: "Identifier",
        name: "env"
      },
      property: {
        type: "Literal",
        value: def.variable
      }
    },
    right: compile(def.value, env)
  };
}

function compileFunctionCall(funcall: SFunctionCall, env: Environment): JSAST {
  return {
    type: "CallExpression",
    callee: compile(funcall.fn, env),
    arguments: funcall.args.map(arg => compile(arg, env))
  };
}

function compileVariable(ref: SVariableReference, env: Environment): JSAST {
  if (ref.variable in env) {
    return {
      type: "Identifier",
      name: env[ref.variable]
    };
  } else {
    return {
      type: "MemberExpression",
      computed: true,
      object: {
        type: "Identifier",
        name: "env"
      },
      property: {
        type: "Literal",
        value: ref.variable
      }
    };
  }
}

function compileLetBindings(expr: SLet, env: Environment): JSAST {
  const newenv = expr.bindings.reduce(
    (acc, binding) => ({
      ...acc,
      [binding.var]: varnameToJS(binding.var)
    }),
    env
  );

  return {
    type: "ExpressionStatement",
    expression: {
      type: "CallExpression",
      callee: {
        type: "FunctionExpression",
        params: expr.bindings.map(b => ({
          type: "Identifier",
          name: newenv[b.var]
        })),
        body: {
          type: "BlockStatement",
          body: [
            {
              type: "ReturnStatement",
              argument: compile(expr.body, newenv)
            }
          ]
        }
      },
      arguments: expr.bindings.map(b => compile(b.value, env))
    }
  };
}

export function compile(expr: Expression, env: Environment): JSAST {
  switch (expr.type) {
    case "number":
      return {
        type: "NumericLiteral",
        value: expr.value
      };
    case "string":
      return {
        type: "Literal",
        value: expr.value
      };
    case "variable-reference":
      return compileVariable(expr, env);
    case "function":
      return compileLambda(expr, env);
    case "function-call":
      return compileFunctionCall(expr, env);
    case "let-bindings":
      return compileLetBindings(expr, env);
  }
}

function compileTopLevel(syntax: Syntax, env: Environment): JSAST {
  const js =
    syntax.type === "definition"
      ? compileDefinition(syntax, env)
      : compile(syntax, env);
  return {
    ...js,
    // Include a comment with the original source code immediately
    // before each toplevel compilation.
    comments: [
      {
        type: "Block",
        value: `
${pprint(syntax, 60)}
`
      }
    ]
  };
}

function compileRuntime(): JSAST {
  return {
    type: "VariableDeclaration",
    kind: "const",
    declarations: [
      {
        type: "VariableDeclarator",
        id: { type: "Identifier", name: "env" },
        init: {
          type: "CallExpression",
          callee: { type: "Identifier", name: "require" },
          arguments: [{ type: "Literal", value: "@delisp/runtime" }]
        }
      }
    ]
  };
}

function compileModule(module: Module, includeRuntime: boolean): JSAST {
  return {
    type: "File",
    program: {
      type: "Program",
      sourceType: "module",
      body: (includeRuntime ? [compileRuntime()] : []).concat(
        module.body.map((syntax: Syntax) => ({
          type: "ExpressionStatement",
          expression: compileTopLevel(syntax, {})
        }))
      )
    }
  };
}

export function compileToString(syntax: Syntax): string {
  const ast = compileModule({ type: "module", body: [syntax] }, false);
  debug("jsast:", ast);
  return recast.print(ast).code;
}

export function compileModuleToString(module: Module): string {
  const ast = compileModule(module, true);
  debug("jsast:", ast);
  return recast.print(ast).code;
}

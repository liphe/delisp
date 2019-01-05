import {
  Expression,
  Module,
  SConditional,
  SDefinition,
  SFunction,
  SFunctionCall,
  SLet,
  SVariableReference,
  Syntax
} from "./syntax";

import {
  compileInlinePrimitive,
  isInlinePrimitive
} from "./compiler/inline-primitives";
import { varnameToJS } from "./compiler/jsvariable";
import { pprint } from "./printer";

import * as JS from "estree";
import * as recast from "recast";

import createDebug from "debug";
const debug = createDebug("delisp:compiler");

interface Environment {
  [symbol: string]: string;
}

// Convert a Delisp variable name to Javascript. This function should
// be injective so there is no collisions and the output should be a
// valid variable name.

function compileLambda(fn: SFunction, env: Environment): JS.Expression {
  const newEnv = fn.lambdaList.reduce(
    (e, param) => ({
      ...e,
      [param.variable]: varnameToJS(param.variable)
    }),
    env
  );
  return {
    type: "ArrowFunctionExpression",
    params: fn.lambdaList.map(
      (param): JS.Pattern => ({
        type: "Identifier",
        name: newEnv[param.variable]
      })
    ),
    body: compile(fn.body, newEnv),
    expression: false
  };
}

function compileDefinition(def: SDefinition, env: Environment): JS.Expression {
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

function compileFunctionCall(
  funcall: SFunctionCall,
  env: Environment
): JS.Expression {
  const compiledArgs = funcall.args.map(arg => compile(arg, env));
  if (
    funcall.fn.type === "variable-reference" &&
    isInlinePrimitive(funcall.fn.variable)
  ) {
    return compileInlinePrimitive(funcall.fn.variable, compiledArgs, "funcall");
  } else {
    return {
      type: "CallExpression",
      callee: compile(funcall.fn, env),
      arguments: compiledArgs
    };
  }
}

function compileVariable(
  ref: SVariableReference,
  env: Environment
): JS.Expression {
  if (isInlinePrimitive(ref.variable)) {
    return compileInlinePrimitive(ref.variable, [], "value");
  } else if (ref.variable in env) {
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

function compileConditional(
  expr: SConditional,
  env: Environment
): JS.Expression {
  return {
    type: "ConditionalExpression",
    test: compile(expr.condition, env),
    consequent: compile(expr.consequent, env),
    alternate: compile(expr.alternative, env)
  };
}

function compileLetBindings(expr: SLet, env: Environment): JS.Expression {
  const newenv = expr.bindings.reduce(
    (acc, binding) => ({
      ...acc,
      [binding.var]: varnameToJS(binding.var)
    }),
    env
  );

  return {
    type: "CallExpression",
    callee: {
      type: "FunctionExpression",
      params: expr.bindings.map(
        (b): JS.Pattern => ({
          type: "Identifier",
          name: newenv[b.var]
        })
      ),
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
  };
}

export function compile(expr: Expression, env: Environment): JS.Expression {
  switch (expr.type) {
    case "number":
      return {
        type: "Literal",
        value: expr.value
      };
    case "string":
      return {
        type: "Literal",
        value: expr.value
      };
    case "variable-reference":
      return compileVariable(expr, env);
    case "conditional":
      return compileConditional(expr, env);
    case "function":
      return compileLambda(expr, env);
    case "function-call":
      return compileFunctionCall(expr, env);
    case "let-bindings":
      return compileLetBindings(expr, env);
  }
}

function compileTopLevel(syntax: Syntax, env: Environment): JS.Expression {
  const js =
    syntax.type === "definition"
      ? compileDefinition(syntax, env)
      : compile(syntax, env);
  return {
    ...js,
    // Include a comment with the original source code immediately
    // before each toplevel compilation.
    leadingComments: [
      {
        type: "Block",
        value: `
${pprint(syntax, 60)}
`
      }
    ]
  };
}

function compileRuntime(): JS.VariableDeclaration {
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

function compileModule(module: Module, includeRuntime: boolean): JS.Program {
  return {
    type: "Program",
    sourceType: "module",
    body: [
      ...(includeRuntime ? [compileRuntime()] : []),
      ...module.body.map(
        (syntax: Syntax): JS.ExpressionStatement => ({
          type: "ExpressionStatement",
          expression: compileTopLevel(syntax, {})
        })
      )
    ]
  };
}

export function compileToString(syntax: Syntax): string {
  const ast = compileModule({ type: "module", body: [syntax] }, false);
  const code = recast.print(ast).code;
  debug("jscode:", code);
  return code;
}

export function compileModuleToString(module: Module): string {
  const ast = compileModule(module, true);
  const code = recast.print(ast).code;
  debug("jscode:", code);
  return recast.print(ast).code;
}

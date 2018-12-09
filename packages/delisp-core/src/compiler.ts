import {
  Expression,
  Module,
  SDefinition,
  SFunction,
  SFunctionCall,
  SVar,
  SVariableReference,
  Syntax
} from "./syntax";

import * as recast from "recast";

import createDebug from "debug";
const debug = createDebug("delisp:compiler");

type JSAST = object;
interface Environment {
  [symbol: string]: string;
}

function compileLambda(fn: SFunction, env: Environment): JSAST {
  const newEnv = fn.lambdaList.reduce(
    (e, param, ix) => ({
      ...e,
      [param.variable]: `p${ix}`
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
  }
}

function compileTopLevel(syntax: Syntax, env: Environment): JSAST {
  if (syntax.type === "definition") {
    return compileDefinition(syntax, env);
  } else {
    return compile(syntax, env);
  }
}

function compileModule(module: Module): JSAST {
  return {
    type: "File",
    program: {
      type: "Program",
      sourceType: "module",
      body: module.body.map((syntax: Syntax) => ({
        type: "ExpressionStatement",
        expression: compileTopLevel(syntax, {})
      }))
    }
  };
}

export function compileToString(syntax: Syntax): string {
  const ast = compileModule({ type: "module", body: [syntax] });
  debug("jsast:", ast);
  return recast.print(ast).code;
}

export function compileModuleToString(module: Module): string {
  const ast = compileModule(module);
  debug("jsast:", ast);
  return recast.print(ast).code;
}

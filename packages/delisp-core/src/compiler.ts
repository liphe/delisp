import { ASExpr, ASExprSymbol, ASExprList } from "./syntax";
import * as recast from "recast";

const debug = require("debug")("delisp:compiler");

type JSAST = object;
interface Environment {
  [symbol: string]: { symbol: ASExprSymbol; jsVar: string };
}

function parseLambdaList(x: ASExpr): ASExprSymbol[] {
  if (x.type !== "list")
    throw new Error("First argument of lambda should be a list");

  if (!x.elements.every(param => param.type === "symbol"))
    throw new Error("First argument of lambda should be a list of symbols");

  return x.elements as ASExprSymbol[];
}

function compileLambda(args: ASExpr[], env: Environment): JSAST {
  if (args.length !== 2) throw new Error("Lambda needs exactly 2 arguments");

  const params = parseLambdaList(args[0]);

  const newEnv = params.reduce(
    (e, param, ix) => ({
      ...e,
      [param.name]: { symbol: param, jsVar: `p${ix}` }
    }),
    env
  );

  return {
    type: "ArrowFunctionExpression",
    params: params.map(symbol => ({
      type: "Identifier",
      name: newEnv[symbol.name].jsVar
    })),
    body: compile(args[1], newEnv)
  };
}

function compileDefinition(args: ASExpr[], env: Environment): JSAST {
  if (args.length !== 2) throw new Error("Define needs exactly 2 arguments");

  const variable = args[0];
  if (variable.type !== "symbol")
    throw new Error("First argument of define should be a symbol");

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
        value: variable.name
      }
    },
    right: compile(args[1], env)
  };
}

function compileList(fn: ASExpr, args: ASExpr[], env: Environment): JSAST {
  if (fn.type === "symbol") {
    switch (fn.name) {
      case "lambda":
        return compileLambda(args, env);
    }
  }

  return {
    type: "CallExpression",
    callee: compile(fn, env),
    arguments: args.map(arg => compile(arg, env))
  };
}

function compileVariable(symbol: ASExprSymbol, env: Environment): JSAST {
  if (symbol.name in env) {
    return {
      type: "Identifier",
      name: env[symbol.name].jsVar
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
        value: symbol.name
      }
    };
  }
}

export function compile(syntax: ASExpr, env: Environment): JSAST {
  switch (syntax.type) {
    case "number":
      return {
        type: "NumericLiteral",
        value: syntax.value
      };
    case "symbol":
      return compileVariable(syntax, env);
    case "string":
      return {
        type: "Literal",
        value: syntax.value
      };
    case "list":
      const [fn, ...args] = syntax.elements;
      return compileList(fn, args, env);
  }
}

function isSpecialForm(syntax: ASExprList, name: string) {
  if (syntax.elements.length > 0) {
    const first = syntax.elements[0];
    return first.type === "symbol" && first.name === name;
  } else {
    return false;
  }
}

function compileTopLevel(syntax: ASExpr, env: Environment): JSAST {
  if (syntax.type === "list" && isSpecialForm(syntax, "define")) {
    return compileDefinition(syntax.elements.slice(1), env);
  } else {
    return compile(syntax, env);
  }
}

export function compileModule(syntax: ASExpr): JSAST {
  return {
    type: "File",
    program: {
      type: "Program",
      sourceType: "module",
      body: [
        {
          type: "ExpressionStatement",
          expression: compileTopLevel(syntax, {})
        }
      ]
    }
  };
}

export function compileToString(syntax: ASExpr): string {
  const ast = compileModule(syntax);
  debug("jsast:", ast);
  return recast.print(ast).code;
}

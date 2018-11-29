import { printHighlightedExpr } from "./error-report";
import { ASExpr, ASExprList, ASExprSymbol } from "./syntax";

import * as recast from "recast";

const debug = require("debug")("delisp:compiler");

type JSAST = object;
interface Environment {
  [symbol: string]: { symbol: ASExprSymbol; jsVar: string };
}

/** Return the last element of a list, or undefined if it is empty */
function last<A>(x: A[]): A | undefined {
  return x[x.length - 1];
}

function parseLambdaList(x: ASExpr): ASExprSymbol[] {
  if (x.type !== "list") {
    throw new Error(printHighlightedExpr("Expected a list of arguments", x));
  }
  x.elements.forEach(arg => {
    if (arg.type !== "symbol") {
      throw new Error(
        printHighlightedExpr(
          "A list of arguments should be made of symbols",
          arg
        )
      );
    }
  });

  return x.elements as ASExprSymbol[];
}

function compileLambda(
  lambda: ASExpr,
  args: ASExpr[],
  env: Environment
): JSAST {
  if (args.length !== 2) {
    throw new Error(
      printHighlightedExpr(
        `'lambda' needs exactly 2 arguments, got ${args.length}`,
        last([lambda, ...args]) as ASExpr, // we know it is not empty!
        true
      )
    );
  }

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

function compileDefinition(
  define: ASExpr,
  args: ASExpr[],
  env: Environment
): JSAST {
  if (args.length !== 2) {
    throw new Error(
      printHighlightedExpr(
        `'define' needs exactly 2 arguments, got ${args.length}`,
        last([define, ...args]) as ASExpr,
        true
      )
    );
  }
  const [variable, value] = args;

  if (variable.type !== "symbol") {
    throw new Error(
      printHighlightedExpr("'define' expected a symbol", variable)
    );
  }

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
    right: compile(value, env)
  };
}

function compileList(fn: ASExpr, args: ASExpr[], env: Environment): JSAST {
  if (fn.type === "symbol") {
    switch (fn.name) {
      case "lambda":
        return compileLambda(fn, args, env);
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
    const [define, ...args] = syntax.elements;
    return compileDefinition(define, args, env);
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

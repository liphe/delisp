import runtime from "@delisp/runtime";
import {
  Expression,
  isDefinition,
  Module,
  SConditional,
  SDefinition,
  SExport,
  SFunction,
  SFunctionCall,
  SLet,
  SRecord,
  SVariableReference,
  SVectorConstructor,
  Syntax
} from "./syntax";
import { last, mapObject } from "./utils";

import {
  DefinitionBackend,
  dynamicDefinition,
  staticDefinition
} from "./compiler/definitions";

import { member } from "./compiler/estree-utils";
import {
  compileInlinePrimitive,
  isInlinePrimitive
} from "./compiler/inline-primitives";
import { identifierToJS, isValidJSIdentifierName } from "./compiler/jsvariable";
import { pprint } from "./printer";

import * as JS from "estree";
import * as recast from "recast";

import createDebug from "debug";
const debug = createDebug("delisp:compiler");

interface EnvironmentBinding {
  jsname: string;
  source: "lexical" | "module" | "primitive";
}

export interface Environment {
  defs: DefinitionBackend;
  bindings: {
    [symbol: string]: EnvironmentBinding;
  };
}

function addBinding(varName: string, env: Environment): Environment {
  return {
    ...env,
    bindings: {
      ...env.bindings,
      [varName]: { jsname: identifierToJS(varName), source: "lexical" }
    }
  };
}

function lookupBinding(varName: string, env: Environment) {
  return env.bindings[varName];
}

function compileBody(body: Expression[], env: Environment): JS.BlockStatement {
  const middleForms = body.slice(0, -1);
  const lastForm = last(body)!;

  return {
    type: "BlockStatement",
    body: [
      ...middleForms.map(
        (e): JS.ExpressionStatement => ({
          type: "ExpressionStatement",
          expression: compile(e, env)
        })
      ),
      {
        type: "ReturnStatement",
        argument: compile(lastForm, env)
      }
    ]
  };
}

// Convert a Delisp variable name to Javascript. This function should
// be injective so there is no collisions and the output should be a
// valid variable name.

function compileLambda(
  fn: SFunction,
  env: Environment
): JS.ArrowFunctionExpression {
  const newEnv = fn.lambdaList.positionalArgs.reduce(
    (e, param) => addBinding(param.variable, e),
    env
  );

  const jsargs = fn.lambdaList.positionalArgs.map(
    (param): JS.Pattern => ({
      type: "Identifier",
      name: lookupBinding(param.variable, newEnv).jsname
    })
  );

  const body: JS.Expression | JS.Statement =
    fn.body.length === 1
      ? compile(fn.body[0], newEnv)
      : compileBody(fn.body, newEnv);

  return {
    type: "ArrowFunctionExpression",
    params: [...jsargs],
    body,
    expression: false
  };
}

function compileDefinition(def: SDefinition, env: Environment): JS.Statement {
  const value = compile(def.value, env);
  const name = lookupBinding(def.variable, env).jsname;
  return env.defs.define(name, value);
}

function compileExport(exp: SExport, env: Environment): JS.Statement {
  return {
    type: "ExpressionStatement",
    expression: {
      type: "AssignmentExpression",
      operator: "=",
      left: member(
        {
          type: "MemberExpression",
          computed: false,
          object: { type: "Identifier", name: "module" },
          property: { type: "Identifier", name: "exports" }
        },
        exp.name
      ),
      right: compile(exp.value, env)
    }
  };
}

function compileFunctionCall(
  funcall: SFunctionCall,
  env: Environment
): JS.Expression {
  const compiledArgs = funcall.args.map(arg => compile(arg, env));
  if (
    funcall.fn.type === "variable-reference" &&
    isInlinePrimitive(funcall.fn.name)
  ) {
    return compileInlinePrimitive(funcall.fn.name, compiledArgs, "funcall");
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
  if (isInlinePrimitive(ref.name)) {
    return compileInlinePrimitive(ref.name, [], "value");
  } else {
    const binding = lookupBinding(ref.name, env);

    if (!binding) {
      return env.defs.access(identifierToJS(ref.name));
    }

    switch (binding.source) {
      case "primitive":
        return member(
          {
            type: "Identifier",
            name: "env"
          },
          binding.jsname
        );
      case "module":
        return env.defs.access(binding.jsname);
      case "lexical":
        return {
          type: "Identifier",
          name: binding.jsname
        };
      default:
        throw new Error("Stupid TS");
    }
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
    (e, binding) => addBinding(binding.var, e),
    env
  );

  return {
    type: "CallExpression",
    callee: {
      type: "FunctionExpression",
      params: expr.bindings.map(
        (b): JS.Pattern => ({
          type: "Identifier",
          name: lookupBinding(b.var, newenv).jsname
        })
      ),
      body: compileBody(expr.body, newenv)
    },
    arguments: expr.bindings.map(b => compile(b.value, env))
  };
}

function literal(value: number | string): JS.Literal {
  return {
    type: "Literal",
    value
  };
}

function identifier(name: string): JS.Identifier {
  return {
    type: "Identifier",
    name
  };
}

function compileVector(
  expr: SVectorConstructor,
  env: Environment
): JS.Expression {
  return {
    type: "ArrayExpression",
    elements: expr.values.map(e => compile(e, env))
  };
}

function compileRecord(expr: SRecord, env: Environment): JS.Expression {
  return {
    type: "ObjectExpression",
    properties: expr.fields.map(
      ({ label, value }): JS.Property => ({
        type: "Property",
        key: isValidJSIdentifierName(label)
          ? identifier(label)
          : literal(label),
        value: compile(value, env),
        kind: "init",
        method: false,
        shorthand: false,
        computed: false
      })
    )
  };
}

export function compile(expr: Expression, env: Environment): JS.Expression {
  switch (expr.type) {
    case "number":
      return literal(expr.value);
    case "string":
      return literal(expr.value);
    case "vector":
      return compileVector(expr, env);
    case "record":
      return compileRecord(expr, env);
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

function compileTopLevel(syntax: Syntax, env: Environment): JS.Statement {
  const js: JS.Statement =
    syntax.type === "definition"
      ? compileDefinition(syntax, env)
      : syntax.type === "export"
      ? compileExport(syntax, env)
      : {
          type: "ExpressionStatement",
          expression: compile(syntax, env)
        };

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

export function moduleEnvironment(
  m: Module,
  definitionContainer?: string
): Environment {
  const moduleDefinitions = m.body
    .filter(isDefinition)
    .map(decl => decl.variable);
  const moduleBindings = moduleDefinitions.reduce(
    (d, decl) => ({
      ...d,
      [decl]: { jsname: identifierToJS(decl), source: "module" }
    }),
    {}
  );

  const primitiveBindings = mapObject(
    runtime,
    (_, key: string): EnvironmentBinding => ({
      jsname: key,
      source: "primitive"
    })
  );

  const initialEnv = {
    defs: definitionContainer
      ? dynamicDefinition(definitionContainer)
      : staticDefinition,

    bindings: { ...primitiveBindings, ...moduleBindings }
  };

  return initialEnv;
}

function compileModule(
  m: Module,
  includeRuntime: boolean,
  env: Environment
): JS.Program {
  return {
    type: "Program",
    sourceType: "module",
    body: [
      ...(includeRuntime ? [compileRuntime()] : []),
      ...m.body.map(
        (syntax: Syntax): JS.Statement => compileTopLevel(syntax, env)
      )
    ]
  };
}

export function compileToString(syntax: Syntax, env: Environment): string {
  const ast = compileModule({ type: "module", body: [syntax] }, false, env);
  const code = recast.print(ast).code;
  debug("jscode:", code);
  return code;
}

export function compileModuleToString(
  m: Module,
  definitionContainer?: string
): string {
  const env = moduleEnvironment(m, definitionContainer);
  const ast = compileModule(m, true, env);
  const code = recast.print(ast).code;
  debug("jscode:", code);
  return code;
}

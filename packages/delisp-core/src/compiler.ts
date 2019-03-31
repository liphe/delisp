import runtime from "@delisp/runtime";
import {
  Expression,
  isDefinition,
  isExport,
  isTypeAlias,
  Module,
  SConditional,
  SDefinition,
  SExport,
  SFunction,
  SFunctionCall,
  SIdentifier,
  SLet,
  SRecord,
  SVectorConstructor,
  Syntax
} from "./syntax";

import { methodCall } from "./compiler/estree-utils";
import { last, mapObject, maybeMap } from "./utils";

import { InvariantViolation } from "./invariant";

import { printHighlightedExpr } from "./error-report";

import {
  DefinitionBackend,
  dynamicDefinition,
  staticDefinition
} from "./compiler/definitions";
import { cjs, esm, ModuleBackend } from "./compiler/modules";

import { member } from "./compiler/estree-utils";
import {
  compileInlinePrimitive,
  isInlinePrimitive
} from "./compiler/inline-primitives";
import { identifierToJS, isValidJSIdentifierName } from "./compiler/jsvariable";
import { pprint } from "./printer";

import * as escodegen from "escodegen";
import * as JS from "estree";

import createDebug from "debug";
const debug = createDebug("delisp:compiler");

interface EnvironmentBinding {
  jsname: string;
  source: "lexical" | "module" | "primitive";
}

export interface Environment {
  defs: DefinitionBackend;
  moduleFormat: ModuleBackend;
  bindings: {
    [symbol: string]: EnvironmentBinding;
  };
}

export interface CompilerOptions {
  definitionContainer?: string;
  esModule?: boolean;
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
  const newEnv = fn.node.lambdaList.positionalArgs.reduce(
    (e, param) => addBinding(param.name, e),
    env
  );

  const jsargs = fn.node.lambdaList.positionalArgs.map(
    (param): JS.Pattern => ({
      type: "Identifier",
      name: lookupBinding(param.name, newEnv).jsname
    })
  );

  const implicitReturn = fn.node.body.length === 1;

  const body: JS.Expression | JS.Statement = implicitReturn
    ? compile(fn.node.body[0], newEnv)
    : compileBody(fn.node.body, newEnv);

  return {
    type: "ArrowFunctionExpression",
    params: [...jsargs],
    body,
    expression: implicitReturn
  };
}

function compileDefinition(def: SDefinition, env: Environment): JS.Statement {
  const value = compile(def.node.value, env);
  const name = lookupBinding(def.node.variable.name, env).jsname;
  return env.defs.define(name, value);
}

function compileFunctionCall(
  funcall: SFunctionCall,
  env: Environment
): JS.Expression {
  const compiledArgs = funcall.node.args.map(arg => compile(arg, env));
  if (
    funcall.node.fn.node.tag === "identifier" &&
    isInlinePrimitive(funcall.node.fn.node.name)
  ) {
    return compileInlinePrimitive(
      funcall.node.fn.node.name,
      compiledArgs,
      "funcall"
    );
  } else {
    return {
      type: "CallExpression",
      callee: compile(funcall.node.fn, env),
      arguments: compiledArgs
    };
  }
}

function compileIdentifier(ref: SIdentifier, env: Environment): JS.Expression {
  const binding = lookupBinding(ref.name, env);

  if (!binding) {
    if (isInlinePrimitive(ref.name)) {
      return compileInlinePrimitive(ref.name, [], "value");
    } else {
      return env.defs.access(identifierToJS(ref.name));
    }
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
      throw new InvariantViolation(
        "This switch-statement should be exhaustive but TS doesn't detect it somehow."
      );
  }
}

function compileConditional(
  expr: SConditional,
  env: Environment
): JS.Expression {
  return {
    type: "ConditionalExpression",
    test: compile(expr.node.condition, env),
    consequent: compile(expr.node.consequent, env),
    alternate: compile(expr.node.alternative, env)
  };
}

function compileLetBindings(expr: SLet, env: Environment): JS.Expression {
  const newenv = expr.node.bindings.reduce(
    (e, binding) => addBinding(binding.variable.name, e),
    env
  );

  return {
    type: "CallExpression",
    callee: {
      type: "FunctionExpression",
      params: expr.node.bindings.map(
        (b): JS.Pattern => ({
          type: "Identifier",
          name: lookupBinding(b.variable.name, newenv).jsname
        })
      ),
      body: compileBody(expr.node.body, newenv)
    },
    arguments: expr.node.bindings.map(b => compile(b.value, env))
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
    elements: expr.node.values.map(e => compile(e, env))
  };
}

function compileRecord(expr: SRecord, env: Environment): JS.Expression {
  const newObj: JS.ObjectExpression = {
    type: "ObjectExpression",
    properties: expr.node.fields.map(
      ({ label, value }): JS.Property => {
        if (!label.name.startsWith(":")) {
          throw new InvariantViolation(`Invalid record ${label}`);
        }

        const name = label.name.replace(/^:/, "");

        return {
          type: "Property",
          key: isValidJSIdentifierName(name) ? identifier(name) : literal(name),
          value: compile(value, env),
          kind: "init",
          method: false,
          shorthand: false,
          computed: false
        };
      }
    )
  };
  if (expr.node.extends) {
    return methodCall({ type: "Identifier", name: "Object" }, "assign", [
      { type: "ObjectExpression", properties: [] },
      compile(expr.node.extends, env),
      newObj
    ]);
  } else {
    return newObj;
  }
}

function compileNumber(value: number): JS.Expression {
  if (value >= 0) {
    return literal(value);
  } else {
    return {
      type: "UnaryExpression",
      operator: "-",
      prefix: true,
      argument: literal(-value)
    };
  }
}

export function compile(expr: Expression, env: Environment): JS.Expression {
  const { node } = expr;
  switch (node.tag) {
    case "number":
      return compileNumber(node.value);
    case "string":
      return literal(node.value);
    case "vector":
      return compileVector({ node }, env);
    case "record":
      return compileRecord({ node }, env);
    case "identifier":
      return compileIdentifier(node, env);
    case "conditional":
      return compileConditional({ node }, env);
    case "function":
      return compileLambda({ node }, env);
    case "function-call":
      return compileFunctionCall({ node }, env);
    case "let-bindings":
      return compileLetBindings({ node }, env);
    case "type-annotation":
      return compile(node.value, env);
  }
}

function compileTopLevel(
  syntax: Syntax,
  env: Environment
): JS.Statement | null {
  if (isExport(syntax) || isTypeAlias(syntax)) {
    // exports are compiled at the end of the module
    return null;
  }

  let js: JS.Statement;

  if (isDefinition(syntax)) {
    js = compileDefinition(syntax, env);
  } else {
    js = {
      type: "ExpressionStatement",
      expression: compile(syntax, env)
    };
  }

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

function compileRuntime(env: Environment): JS.Statement | JS.ModuleDeclaration {
  return env.moduleFormat.importRuntime("env");
}

function compileExports(
  exps: SExport[],
  env: Environment
): Array<JS.Statement | JS.ModuleDeclaration> {
  const exportNames = exps.map(exp => {
    const binding = lookupBinding(exp.node.value.name, env);
    if (!binding || binding.source !== "module") {
      throw new Error(
        printHighlightedExpr(
          "You can only export user definitions",
          exp.node.value.location
        )
      );
    } else {
      return binding.jsname;
    }
  });

  if (exportNames.length > 0) {
    return [env.moduleFormat.export(exportNames)];
  } else {
    return [];
  }
}

export function moduleEnvironment(
  m: Module,
  opts: CompilerOptions = {}
): Environment {
  const moduleDefinitions = m.body
    .filter(isDefinition)
    .map(decl => decl.node.variable.name);
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
    defs: opts.definitionContainer
      ? dynamicDefinition(opts.definitionContainer)
      : staticDefinition,
    moduleFormat: opts.esModule ? esm : cjs,
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
      ...(includeRuntime ? [compileRuntime(env)] : []),
      ...maybeMap((syntax: Syntax) => compileTopLevel(syntax, env), m.body),
      ...compileExports(m.body.filter(isExport), env)
    ]
  };
}

export function compileToString(syntax: Syntax, env: Environment): string {
  const ast = compileModule({ tag: "module", body: [syntax] }, false, env);
  const code = escodegen.generate(ast, { comment: true });
  debug("jscode:", code);
  return code;
}

export function compileModuleToString(
  m: Module,
  opts: CompilerOptions = {}
): string {
  const env = moduleEnvironment(m, opts);
  const ast = compileModule(m, true, env);
  const code = escodegen.generate(ast, { comment: true });
  debug("jscode:", code);
  return code;
}

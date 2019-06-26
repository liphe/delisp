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
  SVariableReference,
  SLet,
  SMatch,
  SCaseTag,
  SRecord,
  SValues,
  SMultipleValueBind,
  SVectorConstructor,
  Syntax,
  SDoBlock,
  SUnknown,
  Typed
} from "./syntax";
import { printType } from "./type-printer";

import {
  methodCall,
  literal,
  identifier,
  primitiveCall,
  arrowFunction
} from "./compiler/estree-utils";
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

function lookupBinding(
  varName: string,
  env: Environment
): EnvironmentBinding | null {
  const binding = env.bindings[varName];
  return binding;
}

function lookupBindingOrError(
  varName: string,
  env: Environment
): EnvironmentBinding {
  const binding = lookupBinding(varName, env);
  if (!binding) {
    throw new Error(`Could not find binding for ${varName}.`);
  }
  return binding;
}

function compileBody(
  body: Expression[],
  env: Environment,
  multipleValues: boolean
): JS.BlockStatement {
  const middleForms = body.slice(0, -1);
  const lastForm = last(body)!;

  return {
    type: "BlockStatement",
    body: [
      ...middleForms.map(
        (e): JS.ExpressionStatement => ({
          type: "ExpressionStatement",
          expression: compile(e, env, false)
        })
      ),
      {
        type: "ReturnStatement",
        argument: compile(lastForm, env, multipleValues)
      }
    ]
  };
}

function compileLambda(
  fn: SFunction,
  env: Environment,
  _multipleValues: boolean
): JS.ArrowFunctionExpression {
  const newEnv = fn.node.lambdaList.positionalArgs.reduce(
    (e, param) => addBinding(param.name, e),
    env
  );

  const jsargs = fn.node.lambdaList.positionalArgs.map(
    (param): JS.Pattern =>
      identifier(lookupBindingOrError(param.name, newEnv).jsname)
  );

  const implicitReturn = fn.node.body.length === 1;

  const body: JS.Expression | JS.Statement = implicitReturn
    ? compile(fn.node.body[0], newEnv, true)
    : compileBody(fn.node.body, newEnv, true);

  return {
    type: "ArrowFunctionExpression",
    params: [identifier("values"), ...jsargs],
    body,
    expression: implicitReturn
  };
}

function compileFunctionCall(
  funcall: SFunctionCall,
  env: Environment,
  multipleValues: boolean
): JS.Expression {
  const compiledArgs = funcall.node.args.map(arg => compile(arg, env, false));
  if (
    funcall.node.fn.node.tag === "variable-reference" &&
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
      callee: compile(funcall.node.fn, env, false),
      arguments: [
        identifier(multipleValues ? "values" : "primaryValue"),
        ...compiledArgs
      ]
    };
  }
}

function compilePrimitive(name: string, env: Environment): JS.Expression {
  const binding = lookupBindingOrError(name, env);
  switch (binding.source) {
    case "primitive":
      return member(identifier("env"), binding.jsname);
    default:
      throw new Error(`${name} is not a valid primitive`);
  }
}

function compileVariable(
  ref: SVariableReference,
  env: Environment,
  _multipleValues: boolean
): JS.Expression {
  const binding = lookupBinding(ref.node.name, env);

  if (!binding) {
    if (isInlinePrimitive(ref.node.name)) {
      return compileInlinePrimitive(ref.node.name, [], "value");
    } else {
      return env.defs.access(identifierToJS(ref.node.name));
    }
  }

  switch (binding.source) {
    case "primitive":
      return member(identifier("env"), binding.jsname);
    case "module":
      return env.defs.access(binding.jsname);
    case "lexical":
      return identifier(binding.jsname);
  }
}

function compileConditional(
  expr: SConditional,
  env: Environment,
  multipleValues: boolean
): JS.Expression {
  return {
    type: "ConditionalExpression",
    test: compile(expr.node.condition, env, false),
    consequent: compile(expr.node.consequent, env, multipleValues),
    alternate: compile(expr.node.alternative, env, multipleValues)
  };
}

function compileLetBindings(
  expr: SLet,
  env: Environment,
  multipleValues: boolean
): JS.Expression {
  const newenv = expr.node.bindings.reduce(
    (e, binding) => addBinding(binding.variable.name, e),
    env
  );

  return {
    type: "CallExpression",
    callee: {
      type: "FunctionExpression",
      params: expr.node.bindings.map(
        (b): JS.Pattern =>
          identifier(lookupBindingOrError(b.variable.name, newenv).jsname)
      ),
      body: compileBody(expr.node.body, newenv, multipleValues)
    },
    arguments: expr.node.bindings.map(b => compile(b.value, env, false))
  };
}

function compileVector(
  expr: SVectorConstructor,
  env: Environment,
  _multipleValues: boolean
): JS.Expression {
  return {
    type: "ArrayExpression",
    elements: expr.node.values.map(e => compile(e, env, false))
  };
}

function compileRecord(
  expr: SRecord,
  env: Environment,
  multipleValues: boolean
): JS.Expression {
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
          value: compile(value, env, multipleValues),
          kind: "init",
          method: false,
          shorthand: false,
          computed: false
        };
      }
    )
  };
  if (expr.node.extends) {
    return methodCall(identifier("Object"), "assign", [
      { type: "ObjectExpression", properties: [] },
      compile(expr.node.extends, env, false),
      newObj
    ]);
  } else {
    return newObj;
  }
}

function compileNumber(
  value: number,
  _env: Environment,
  _multipleValues: boolean
): JS.Expression {
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

function compileDoBlock(
  expr: SDoBlock,
  env: Environment,
  multipleValues: boolean
): JS.Expression {
  return {
    type: "SequenceExpression",
    expressions: [
      ...expr.node.body.map(f => compile(f, env, false)),
      compile(expr.node.returning, env, multipleValues)
    ]
  };
}

function compileMatch(
  expr: SMatch,
  env: Environment,
  multipleValues: boolean
): JS.Expression {
  const defaultCase: JS.ArrowFunctionExpression | undefined = expr.node
    .defaultCase && {
    type: "ArrowFunctionExpression",
    expression: false,
    generator: false,
    params: [],
    body: (() => {
      return compileBody(expr.node.defaultCase, env, multipleValues);
    })()
  };

  return primitiveCall(
    "matchTag",
    compile(expr.node.value, env, false),
    {
      type: "ObjectExpression",
      properties: expr.node.cases.map(c => ({
        type: "Property",
        kind: "init",
        method: false,
        shorthand: false,
        computed: false,
        key: literal(c.label),
        value: {
          type: "ArrowFunctionExpression",
          kind: "init",
          id: null,
          expression: false,
          generator: false,
          params: [identifier(identifierToJS(c.variable.name))],
          body: (() => {
            const newenv = addBinding(c.variable.name, env);
            return compileBody(c.body, newenv, multipleValues);
          })()
        }
      }))
    },
    ...(defaultCase ? [defaultCase] : [])
  );
}

function compileTag(
  expr: SCaseTag,
  env: Environment,
  _multipleValues: boolean
): JS.Expression {
  return primitiveCall(
    "caseTag",
    literal(expr.node.label),
    ...(expr.node.value ? [compile(expr.node.value, env, false)] : [])
  );
}

function compileValues(
  expr: SValues,
  env: Environment,
  _multipleValues: boolean
): JS.Expression {
  return {
    type: "CallExpression",
    callee: identifier("values"),
    arguments: expr.node.values.map(e => compile(e, env, false))
  };
}

function compileMultipleValueBind(
  expr: SMultipleValueBind,
  env: Environment,
  multipleValues: boolean
): JS.Expression {
  const form = arrowFunction(["values"], compile(expr.node.form, env, true));
  const newenv = expr.node.variables.reduce((env, v) => {
    return addBinding(v.name, env);
  }, env);
  const continuation: JS.ArrowFunctionExpression = {
    type: "ArrowFunctionExpression",
    params: expr.node.variables.map(v =>
      identifier(lookupBindingOrError(v.name, newenv).jsname)
    ),
    expression: false,
    body: compileBody(expr.node.body, newenv, multipleValues)
  };
  return {
    type: "CallExpression",
    callee: form,
    arguments: [continuation]
  };
}

function compileUnknown(
  _expr: SUnknown,
  env: Environment,
  _multipleValues: boolean
): JS.Expression {
  const unknownFn = compilePrimitive("unknown", env);
  const message = literal("Reached code that did not compile properly.");
  const file = literal("file");
  const line = literal(1);
  const column = literal(1);
  return {
    type: "CallExpression",
    callee: unknownFn,
    arguments: [message, file, line, column]
  };
}

export function compile(
  expr: Expression,
  env: Environment,
  multipleValues: boolean
): JS.Expression {
  switch (expr.node.tag) {
    case "unknown":
      return compileUnknown({ ...expr, node: expr.node }, env, multipleValues);
    case "number":
      return compileNumber(expr.node.value, env, multipleValues);
    case "string":
      return literal(expr.node.value);
    case "vector":
      return compileVector({ ...expr, node: expr.node }, env, multipleValues);
    case "record":
      return compileRecord({ ...expr, node: expr.node }, env, multipleValues);
    case "variable-reference":
      return compileVariable({ ...expr, node: expr.node }, env, multipleValues);
    case "conditional":
      return compileConditional(
        { ...expr, node: expr.node },
        env,
        multipleValues
      );
    case "function":
      return compileLambda({ ...expr, node: expr.node }, env, multipleValues);
    case "function-call":
      return compileFunctionCall(
        { ...expr, node: expr.node },
        env,
        multipleValues
      );
    case "values":
      return compileValues({ ...expr, node: expr.node }, env, multipleValues);
    case "multiple-value-bind":
      return compileMultipleValueBind(
        { ...expr, node: expr.node },
        env,
        multipleValues
      );
    case "let-bindings":
      return compileLetBindings(
        { ...expr, node: expr.node },
        env,
        multipleValues
      );
    case "type-annotation":
      return compile(expr.node.value, env, multipleValues);
    case "do-block":
      return compileDoBlock({ ...expr, node: expr.node }, env, multipleValues);
    case "match":
      return compileMatch({ ...expr, node: expr.node }, env, multipleValues);
    case "case":
      return compileTag({ ...expr, node: expr.node }, env, multipleValues);
  }
}

function compileDefinition(def: SDefinition, env: Environment): JS.Statement {
  const value = compile(def.node.value, env, false);
  const name = lookupBindingOrError(def.node.variable.name, env).jsname;
  return env.defs.define(name, value);
}

function compileTopLevel(
  syntax: Syntax,
  env: Environment,
  multipleValues: boolean
): JS.Statement | null {
  const typedSyntax = syntax as Syntax<Partial<Typed>, Partial<Typed>>;

  if (isExport(typedSyntax) || isTypeAlias(typedSyntax)) {
    // exports are compiled at the end of the module
    return null;
  }

  let js: JS.Statement;
  let type;

  if (isDefinition(typedSyntax)) {
    js = compileDefinition(typedSyntax, env);
    type = typedSyntax.node.value.info.type;
  } else {
    js = {
      type: "ExpressionStatement",
      expression: compile(typedSyntax, env, multipleValues)
    };
    type = typedSyntax.info.type;
  }

  return {
    ...js,
    // Include a comment with the original source code immediately
    // before each toplevel compilation.
    leadingComments: [
      {
        type: "Block",
        value: `
${type ? printType(type) : ""}
${pprint(syntax, 40)}
`
      }
    ]
  };
}

function compileRuntime(env: Environment): JS.Statement | JS.ModuleDeclaration {
  return env.moduleFormat.importRuntime("env");
}

function compileRuntimeUtils(
  env: Environment
): JS.Statement | JS.ModuleDeclaration {
  return env.moduleFormat.importRuntimeUtils([
    "matchTag",
    "caseTag",
    "pair",
    "fst",
    "snd",
    "primaryValue",
    "values",
    "mvbind",
    "bindPrimaryValue"
  ]);
}

function compileExports(
  exps: SExport[],
  env: Environment
): Array<JS.Statement | JS.ModuleDeclaration> {
  const exportNames = exps.map(exp => {
    const binding = lookupBindingOrError(exp.node.value.name, env);
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
      ...(includeRuntime
        ? [compileRuntime(env), compileRuntimeUtils(env)]
        : []),
      ...maybeMap(
        (syntax: Syntax) => compileTopLevel(syntax, env, false),
        m.body
      ),
      ...compileExports(m.body.filter(isExport), env)
    ]
  };
}

export function compileToString(syntax: Syntax, env: Environment): string {
  const ast = compileTopLevel(syntax, env, true);
  if (!ast) return "";
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

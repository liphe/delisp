import runtime from "@delisp/runtime";
import createDebug from "debug";
import * as escodegen from "escodegen";
import * as JS from "estree";
import {
  DefinitionBackend,
  dynamicDefinition,
  staticDefinition
} from "./compiler/definitions";
import {
  arrowFunction,
  identifier,
  literal,
  member,
  methodCall,
  objectExpression,
  primitiveCall
} from "./compiler/estree-utils";
import {
  compileInlinePrimitive,
  isInlinePrimitive
} from "./compiler/inline-primitives";
import { identifierToJS } from "./compiler/jsvariable";
import { cjs, esm, ModuleBackend } from "./compiler/modules";
import { printHighlightedExpr } from "./error-report";
import { InvariantViolation } from "./invariant";
import { moduleExports, moduleImports } from "./module";
import { pprint } from "./printer";
import * as S from "./syntax";
import { printType } from "./type-printer";
import { last, mapObject, maybeMap } from "./utils";

const debug = createDebug("delisp:compiler");

interface EnvironmentBinding {
  jsname: string;
  source: "lexical" | "module" | "primitive";
}

export interface Environment {
  defs: DefinitionBackend;
  moduleFormat: ModuleBackend;
  getOutputFile(string: string): string;
  bindings: {
    [symbol: string]: EnvironmentBinding;
  };
}

export interface CompilerOptions {
  definitionContainer?: string;
  getOutputFile(file: string): string;
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
  body: S.Expression[],
  env: Environment,
  multipleValues: boolean
): JS.Expression[] {
  const middleForms = body.slice(0, -1);
  const lastForm = last(body)!;
  return [
    ...middleForms.map(e => compile(e, env, false)),
    compile(lastForm, env, multipleValues)
  ];
}

function compileLambda(
  fn: S.SFunction,
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

  const body = compileBody(fn.node.body, newEnv, true);

  return arrowFunction([identifier("values"), ...jsargs], body);
}

function compileFunctionCall(
  funcall: S.SFunctionCall,
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
  ref: S.SVariableReference,
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
  expr: S.SConditional,
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
  expr: S.SLet,
  env: Environment,
  multipleValues: boolean
): JS.Expression {
  const newenv = expr.node.bindings.reduce(
    (e, binding) => addBinding(binding.variable.name, e),
    env
  );

  const params = expr.node.bindings.map(
    (b): JS.Pattern =>
      identifier(lookupBindingOrError(b.variable.name, newenv).jsname)
  );

  return {
    type: "CallExpression",
    callee: arrowFunction(
      params,
      compileBody(expr.node.body, newenv, multipleValues)
    ),
    arguments: expr.node.bindings.map(b => compile(b.value, env, false))
  };
}

function compileVector(
  expr: S.SVectorConstructor,
  env: Environment,
  _multipleValues: boolean
): JS.Expression {
  return {
    type: "ArrayExpression",
    elements: expr.node.values.map(e => compile(e, env, false))
  };
}

function compileRecord(
  expr: S.SRecord,
  env: Environment,
  multipleValues: boolean
): JS.Expression {
  const newObj = objectExpression(
    expr.node.fields.map(({ label, value }) => {
      if (!label.name.startsWith(":")) {
        throw new InvariantViolation(`Invalid record ${label}`);
      }
      const name = label.name.replace(/^:/, "");
      return {
        key: name,
        value: compile(value, env, multipleValues)
      };
    })
  );

  if (expr.node.extends) {
    return methodCall(identifier("Object"), "assign", [
      objectExpression([]),
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
  expr: S.SDoBlock,
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
  expr: S.SMatch,
  env: Environment,
  multipleValues: boolean
): JS.Expression {
  const defaultCase =
    expr.node.defaultCase &&
    arrowFunction([], compileBody(expr.node.defaultCase, env, multipleValues));

  return primitiveCall(
    "matchTag",
    compile(expr.node.value, env, false),

    objectExpression(
      expr.node.cases.map(c => ({
        key: c.label,
        value: arrowFunction(
          [identifier(identifierToJS(c.variable.name))],
          (() => {
            const newenv = addBinding(c.variable.name, env);
            return compileBody(c.body, newenv, multipleValues);
          })()
        )
      }))
    ),

    ...(defaultCase ? [defaultCase] : [])
  );
}

function compileTag(
  expr: S.SCaseTag,
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
  expr: S.SValues,
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
  expr: S.SMultipleValueBind,
  env: Environment,
  multipleValues: boolean
): JS.Expression {
  const form = arrowFunction(
    [identifier("values")],
    [compile(expr.node.form, env, true)]
  );
  const newenv = expr.node.variables.reduce((env, v) => {
    return addBinding(v.name, env);
  }, env);

  const params = expr.node.variables.map(v =>
    identifier(lookupBindingOrError(v.name, newenv).jsname)
  );

  const continuation = arrowFunction(
    params,
    compileBody(expr.node.body, newenv, multipleValues)
  );

  return primitiveCall("mvbind", form, continuation);
}

function compileUnknown(
  _expr: S.SUnknown,
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
  expr: S.Expression,
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

function compileDefinition(def: S.SDefinition, env: Environment): JS.Statement {
  const value = compile(def.node.value, env, false);
  const name = lookupBindingOrError(def.node.variable.name, env).jsname;
  return env.defs.define(name, value);
}

function compileTopLevel(
  syntax: S.Syntax,
  env: Environment,
  multipleValues: boolean
): JS.Statement | null {
  const typedSyntax = syntax as S.Syntax<Partial<S.Typed>, Partial<S.Typed>>;

  if (
    S.isImport(typedSyntax) ||
    S.isExport(typedSyntax) ||
    S.isTypeAlias(typedSyntax)
  ) {
    // exports are compiled at the end of the module
    return null;
  }

  let js: JS.Statement;
  let type;

  if (S.isDefinition(typedSyntax)) {
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
    "primPair",
    "primFst",
    "primSnd",
    "primaryValue",
    "values",
    "bindPrimaryValue",
    "mvbind",
    "assert"
  ]);
}

function compileImports(
  imports: S.SImport[],
  env: Environment
): Array<JS.Statement | JS.ModuleDeclaration> {
  return imports.map(i =>
    env.moduleFormat.importNames(
      [identifierToJS(i.node.variable.name)],
      env.getOutputFile(i.node.source),
      env.defs
    )
  );
}

function compileExports(
  exps: S.SExport[],
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
  m: S.Module,
  opts: CompilerOptions
): Environment {
  const moduleDefinitions = m.body
    .filter(S.isDefinition)
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
    bindings: { ...primitiveBindings, ...moduleBindings },
    getOutputFile: opts.getOutputFile
  };

  return initialEnv;
}

function compileModule(
  m: S.Module,
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

      ...compileImports(moduleImports(m), env),

      ...maybeMap(
        (syntax: S.Syntax) => compileTopLevel(syntax, env, false),
        m.body
      ),
      ...compileExports(moduleExports(m), env)
    ]
  };
}

export function compileToString(syntax: S.Syntax, env: Environment): string {
  const ast = compileTopLevel(syntax, env, true);
  if (!ast) return "";
  const code = escodegen.generate(ast, { comment: true });
  debug("jscode:", code);
  return code;
}

export function compileModuleToString(
  m: S.Module,
  opts: CompilerOptions
): string {
  const env = moduleEnvironment(m, opts);
  const ast = compileModule(m, true, env);
  const code = escodegen.generate(ast, { comment: true });
  debug("jscode:", code);
  return code;
}

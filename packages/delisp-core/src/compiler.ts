import runtime from "@delisp/runtime";
import createDebug from "debug";
import * as escodegen from "escodegen";
import * as JS from "estree";
import {
  DefinitionBackend,
  dynamicDefinition,
  staticDefinition,
} from "./compiler/definitions";
import {
  arrowFunction,
  identifier,
  literal,
  member,
  methodCall,
  awaitExpr,
  objectExpression,
  primitiveCall,
  comment,
} from "./compiler/estree-utils";
import {
  findInlinePrimitive,
  isInlinePrimitive,
} from "./compiler/inline-primitives";
import { cjs, esm, ModuleBackend } from "./compiler/modules";
import { printHighlightedExpr } from "./error-report";
import { InvariantViolation } from "./invariant";
import { moduleExports, moduleImports } from "./module";
import { pprint } from "./printer";
import * as S from "./syntax";
import { Typed } from "./syntax-typed";
import { printType } from "./type-printer";
import { Type } from "./types";
import { getCallEffects } from "./type-utils";
import { flatMap, last, mapObject, maybeMap, range } from "./utils";

const debug = createDebug("delisp:compiler");

interface EnvironmentBinding {
  name: string;
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
      [varName]: { name: varName, source: "lexical" },
    },
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
  body: S.Expression<Typed>[],
  env: Environment,
  multipleValues: boolean
): JS.Expression[] {
  const middleForms = body.slice(0, -1);
  const lastForm = last(body)!;
  return [
    ...middleForms.map((e) => compile(e, env, false)),
    compile(lastForm, env, multipleValues),
  ];
}

function compileLambda(
  fn: S.SFunction<Typed>,
  env: Environment,
  _multipleValues: boolean
): JS.ArrowFunctionExpression {
  const newEnv = fn.node.lambdaList.positionalArguments.reduce(
    (e, param) => addBinding(param.name, e),
    env
  );

  const jsargs = fn.node.lambdaList.positionalArguments.map(
    (param): JS.Pattern =>
      identifier(lookupBindingOrError(param.name, newEnv).name)
  );

  const body = compileBody(fn.node.body, newEnv, true);

  return arrowFunction([identifier("values"), ...jsargs], body);
}

function isFunctionAsync(fntype: Type): boolean {
  const selfEffects = getCallEffects(fntype);
  return (
    Boolean(selfEffects.fields.find((f) => f.label === "async")) ||
    selfEffects.extends.node.tag !== "empty-row"
  );
}

function compileFunctionCall(
  funcall: S.SFunctionCall<Typed>,
  env: Environment,
  multipleValues: boolean
): JS.Expression {
  const compiledArgs = funcall.node.arguments.map((arg) =>
    compile(arg, env, false)
  );
  if (
    funcall.node.fn.node.tag === "variable-reference" &&
    isInlinePrimitive(funcall.node.fn.node.name)
  ) {
    return compileInlinePrimitive(funcall.node.fn.node.name, compiledArgs);
  } else {
    const { fn } = funcall.node;
    const isAsync = funcall.node.closedFunctionEffect
      ? isFunctionAsync(funcall.node.closedFunctionEffect)
      : true;

    const call: JS.Expression = {
      type: "CallExpression",
      callee: compile(fn, env, false),
      arguments: [
        identifier(multipleValues ? "values" : "primaryValue"),
        ...compiledArgs,
      ],
    };
    return isAsync ? awaitExpr(call) : call;
  }
}

/** Compile a inline primitive with a set of parameters. */
function compileInlinePrimitive(
  name: string,
  args: JS.Expression[]
): JS.Expression {
  const prim = findInlinePrimitive(name);
  const isAsync = isFunctionAsync(prim.type.mono);
  const inline = prim.funcHandler(args);
  return isAsync ? awaitExpr(inline) : inline;
}

function compileInlineValue(name: string): JS.Expression {
  const prim = findInlinePrimitive(name);
  /* If the primitive is used in a value position, a wrapper function
     will be created so the inlined primitive can be used as a
     function. */
  const identifiers = range(prim.arity).map((i) => identifier(`x${i}`));
  return arrowFunction(
    [identifier("values"), ...identifiers],
    [prim.funcHandler(identifiers)]
  );
}

function compilePrimitive(name: string, env: Environment): JS.Expression {
  const binding = lookupBindingOrError(name, env);
  switch (binding.source) {
    case "primitive":
      return member(identifier("env"), binding.name);
    default:
      throw new Error(`${name} is not a valid primitive`);
  }
}

function compileVariable(
  ref: S.SVariableReference<Typed>,
  env: Environment,
  _multipleValues: boolean
): JS.Expression {
  const binding = lookupBinding(ref.node.name, env);
  if (!binding) {
    if (isInlinePrimitive(ref.node.name)) {
      return compileInlineValue(ref.node.name);
    } else {
      return env.defs.access(ref.node.name);
    }
  }
  switch (binding.source) {
    case "primitive":
      return member(identifier("env"), binding.name);
    case "module":
      return env.defs.access(binding.name);
    case "lexical":
      return identifier(binding.name);
  }
}

function compileConditional(
  expr: S.SConditional<Typed>,
  env: Environment,
  multipleValues: boolean
): JS.Expression {
  return {
    type: "ConditionalExpression",
    test: compile(expr.node.condition, env, false),
    consequent: compile(expr.node.consequent, env, multipleValues),
    alternate: compile(expr.node.alternative, env, multipleValues),
  };
}

function compileLetBindings(
  expr: S.SLet<Typed>,
  env: Environment,
  multipleValues: boolean
): JS.Expression {
  const newenv = expr.node.bindings.reduce(
    (e, binding) => addBinding(binding.variable.name, e),
    env
  );

  const params = expr.node.bindings.map(
    (b): JS.Pattern =>
      identifier(lookupBindingOrError(b.variable.name, newenv).name)
  );

  const func = arrowFunction(
    params,
    compileBody(expr.node.body, newenv, multipleValues)
  );

  const call: JS.Expression = {
    type: "CallExpression",
    callee: func,
    arguments: expr.node.bindings.map((b) => compile(b.value, env, false)),
  };

  return func.async ? awaitExpr(call) : call;
}

function compileVector(
  expr: S.SVectorConstructor<Typed>,
  env: Environment,
  _multipleValues: boolean
): JS.Expression {
  return {
    type: "ArrayExpression",
    elements: expr.node.values.map((e) => compile(e, env, false)),
  };
}

function labelToPropertyName(label: S.Identifier): string {
  if (!label.name.startsWith(":")) {
    throw new InvariantViolation(`Invalid record label ${label}.`);
  }
  return label.name.replace(/^:/, "");
}

function compileRecord(
  expr: S.SRecord<Typed>,
  env: Environment,
  multipleValues: boolean
): JS.Expression {
  const newObj = objectExpression(
    expr.node.fields.map(({ label, value }) => {
      const name = labelToPropertyName(label);
      return {
        key: name,
        value: compile(value, env, multipleValues),
      };
    })
  );

  if (expr.node.source) {
    // NOTE: we do not care if the record is being extended or updated
    // here. As we do not provide a `delete` operation on records, the
    // previous values are not recoverable anyway so we can just
    // update it.
    return methodCall(identifier("Object"), "assign", [
      objectExpression([]),
      compile(expr.node.source.expression, env, false),
      newObj,
    ]);
  } else {
    return newObj;
  }
}

function compileRecordGet(
  expr: S.SRecordGet<Typed>,
  env: Environment,
  _multipleValues: boolean
) {
  const name = labelToPropertyName(expr.node.field);
  const record = compile(expr.node.value, env, false);
  return member(record, name);
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
      argument: literal(-value),
    };
  }
}

function compileDoBlock(
  expr: S.SDoBlock<Typed>,
  env: Environment,
  multipleValues: boolean
): JS.Expression {
  return {
    type: "SequenceExpression",
    expressions: [
      ...expr.node.body.map((f) => compile(f, env, false)),
      compile(expr.node.returning, env, multipleValues),
    ],
  };
}

function compileMatch(
  expr: S.SMatch<Typed>,
  env: Environment,
  multipleValues: boolean
): JS.Expression {
  const cases = expr.node.cases.map((c) => ({
    key: c.label,
    value: arrowFunction(
      [identifier(c.variable.name)],
      (() => {
        const newenv = addBinding(c.variable.name, env);
        return compileBody(c.body, newenv, multipleValues);
      })()
    ),
  }));

  const defaultCase =
    expr.node.defaultCase &&
    arrowFunction([], compileBody(expr.node.defaultCase, env, multipleValues));

  const call = primitiveCall(
    "matchTag",
    compile(expr.node.value, env, false),
    objectExpression(cases),
    ...(defaultCase ? [defaultCase] : [])
  );

  const isAsync =
    cases.some((c) => c.value.async) || (defaultCase && defaultCase.async);

  return isAsync ? awaitExpr(call) : call;
}

function compileTag(
  expr: S.SCaseTag<Typed>,
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
  expr: S.SValues<Typed>,
  env: Environment,
  _multipleValues: boolean
): JS.Expression {
  return {
    type: "CallExpression",
    callee: identifier("values"),
    arguments: expr.node.values.map((e) => compile(e, env, false)),
  };
}

function compileMultipleValueBind(
  expr: S.SMultipleValueBind<Typed>,
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

  const params = expr.node.variables.map((v) =>
    identifier(lookupBindingOrError(v.name, newenv).name)
  );

  const continuation = arrowFunction(
    params,
    compileBody(expr.node.body, newenv, multipleValues)
  );

  return primitiveCall("mvbind", form, continuation);
}

function compileUnknown(
  _expr: S.SUnknown<Typed>,
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
    arguments: [message, file, line, column],
  };
}

export function compile(
  expr: S.Expression<Typed>,
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
    case "boolean":
      return literal(expr.node.value);
    case "none":
      return identifier("undefined");
    case "vector":
      return compileVector({ ...expr, node: expr.node }, env, multipleValues);
    case "record":
      return compileRecord({ ...expr, node: expr.node }, env, multipleValues);
    case "record-get":
      return compileRecordGet(
        { ...expr, node: expr.node },
        env,
        multipleValues
      );
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

function compileDefinition(
  def: S.SDefinition<Typed>,
  env: Environment
): JS.Statement {
  const value = compile(def.node.value, env, false);
  const name = lookupBindingOrError(def.node.variable.name, env).name;
  return env.defs.define(name, value);
}

function compileTopLevel(
  syntax: S.Syntax<Typed>,
  env: Environment,
  multipleValues: boolean
): JS.Statement | null {
  if (S.isImport(syntax) || S.isExport(syntax) || S.isTypeAlias(syntax)) {
    // exports are compiled at the end of the module
    return null;
  }

  if (S.isDefinition(syntax)) {
    const info = syntax.node.value.info;
    const type: Type | undefined = info ? info.resultingType : undefined;
    const js = compileDefinition(syntax, env);
    return comment(
      `
${type ? printType(type) : ""}
${pprint(syntax, 40)}
`,
      js
    );
  } else if (S.isExpression(syntax)) {
    const info = syntax.info;
    const type = info ? info.resultingType : undefined;
    const js: JS.Statement = {
      type: "ExpressionStatement",
      expression: compile(syntax, env, multipleValues),
    };
    return comment(
      `
${type ? printType(type) : ""}
${pprint(syntax, 40)}
`,
      js
    );
  } else {
    throw new InvariantViolation(`Can't compile unknown toplevel form.`);
  }
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
    "assert",
    "promiseMap",
    "promiseReduce",
    "promiseFilter",
    "promiseDelay",
  ]);
}

function compileImports(
  imports: S.SImport[],
  env: Environment
): (JS.Statement | JS.ModuleDeclaration)[] {
  return imports.map((i) =>
    env.moduleFormat.importNames(
      [i.node.variable.name],
      env.getOutputFile(i.node.source),
      env.defs
    )
  );
}

function compileExports(
  exps: S.SExport[],
  env: Environment
): (JS.Statement | JS.ModuleDeclaration)[] {
  const exportNames = flatMap((exp) => exp.node.identifiers, exps).map(
    (identifier) => {
      const binding = lookupBindingOrError(identifier.name, env);
      if (!binding || binding.source !== "module") {
        throw new Error(
          printHighlightedExpr(
            "You can only export user definitions",
            identifier.location
          )
        );
      } else {
        return binding.name;
      }
    }
  );

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
    .map((decl) => decl.node.variable.name);
  const moduleBindings = moduleDefinitions.reduce(
    (d, decl) => ({
      ...d,
      [decl]: { name: decl, source: "module" },
    }),
    {}
  );

  const primitiveBindings = mapObject(
    runtime,
    (_, key: string): EnvironmentBinding => ({
      name: key,
      source: "primitive",
    })
  );

  const initialEnv = {
    defs: opts.definitionContainer
      ? dynamicDefinition(opts.definitionContainer)
      : staticDefinition,
    moduleFormat: opts.esModule ? esm : cjs,
    bindings: { ...primitiveBindings, ...moduleBindings },
    getOutputFile: opts.getOutputFile,
  };

  return initialEnv;
}

function compileModule(
  m: S.Module<Typed>,
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

      ...maybeMap((syntax) => compileTopLevel(syntax, env, false), m.body),
      ...compileExports(moduleExports(m), env),
    ],
  };
}

export function compileToString(
  syntax: S.Syntax<Typed>,
  env: Environment
): string {
  const ast = compileTopLevel(syntax, env, true);
  if (!ast) return "";
  const code = escodegen.generate(ast, { comment: true });
  debug("jscode:", code);
  return code;
}

export function compileModuleToString(
  m: S.Module<Typed>,
  opts: CompilerOptions
): string {
  const env = moduleEnvironment(m, opts);
  const ast = compileModule(m, true, env);
  const code = escodegen.generate(ast, { comment: true });
  debug("jscode:", code);
  return code;
}

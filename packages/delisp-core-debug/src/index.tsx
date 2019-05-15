import React, { useReducer } from "react";
import ReactDOM from "react-dom";

import { updateCode, State, reducer } from "./state";

import {
  Module,
  Syntax,
  Expression,
  isExpression,
  readModule,
  inferModule,
  pprint,
  exprFChildren,
  Typed
} from "@delisp/core";

const initialState: State = {
  code: ""
};

type ASTResult =
  | { tag: "success"; module: Module<Typed> }
  | { tag: "error"; message: string };

function readModuleOrError(code: string): ASTResult {
  try {
    const m = readModule(code);
    const inferredM = inferModule(m);
    return { tag: "success", module: inferredM.typedModule };
  } catch (err) {
    return { tag: "error", message: err.message };
  }
}

function AST(props: { code: string }) {
  const { code } = props;
  const result = readModuleOrError(code);
  switch (result.tag) {
    case "success":
      return <ModuleExplorer module={result.module} />;
    case "error":
      return (
        <div>
          <span>Something went wrong</span>
          <pre>{result.message}</pre>
        </div>
      );
  }
}

function ModuleExplorer({ module: m }: { module: Module<Typed> }) {
  return (
    <div>
      {m.body.map(s => (
        <DeclExplorer syntax={s} />
      ))}
    </div>
  );
}

function DeclExplorer({ syntax }: { syntax: Syntax<Typed> }) {
  if (isExpression(syntax)) {
    return <ExpressionExplorer expr={syntax} />;
  } else {
    return <UnknownExplorer value={syntax} />;
  }
}

function ExpressionExplorer({ expr }: { expr: Expression<Typed> }) {
  const subexpr = exprFChildren(expr).map((e, i) => (
    <ExpressionExplorer key={i} expr={e} />
  ));
  return (
    <div>
      <pre>{pprint(expr, 80)}</pre>
      {subexpr.length === 0 ? null : (
        <details>
          <summary>Subexpressions</summary>
          {subexpr}
        </details>
      )}
      <details>
        <summary>Type</summary>
        <UnknownExplorer value={expr.info.type} />
      </details>
      <details>
        <summary>Effect</summary>
        <UnknownExplorer value={expr.info.effect} />
      </details>
      <details>
        <summary>Location</summary>
        <UnknownExplorer value={expr.location} />
      </details>
      <div />
    </div>
  );
}

function UnknownExplorer({ value }: { value: unknown }) {
  return <pre>{JSON.stringify(value, null, 2)}</pre>;
}

function App() {
  const [state, dispatch] = useReducer(reducer, initialState);

  return (
    <div>
      <h1>delisp-core-debug</h1>
      <textarea
        value={state.code}
        onChange={e => dispatch(updateCode(e.target.value))}
      />
      <AST code={state.code} />
    </div>
  );
}

function start() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  ReactDOM.render(<App />, container);
}

start();

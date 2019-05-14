import React, { useReducer } from "react";
import ReactDOM from "react-dom";

import { updateCode, State, reducer } from "./state";

import { readModule, inferModule } from "@delisp/core";

const initialState: State = {
  code: ""
};

type Module = ReturnType<typeof inferModule>["typedModule"];

type ASTResult =
  | { tag: "success"; module: Module }
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

function ModuleExplorer(props: { module: Module }) {
  const m = props.module;
  return <pre>{JSON.stringify(m, null, 2)}</pre>;
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
  const container = document.getElementById("app");
  ReactDOM.render(<App />, container);
}

start();

import React, { useReducer } from "react";
import ReactDOM from "react-dom";

import { updateCode, State, reducer } from "./state";

import { readModule, inferModule } from "@delisp/core";

const initialState: State = {
  code: ""
};

function AST(props: { code: string }) {
  const { code } = props;
  const m = readModule(code);
  const inferredM = m && inferModule(m);
  return <pre>{JSON.stringify(inferredM.typedModule, null, 2)}</pre>;
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

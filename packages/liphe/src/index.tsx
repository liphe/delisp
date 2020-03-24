import React, { useReducer } from "react";
import ReactDOM from "react-dom";
import { App } from "./App";

import { State, reducer } from "./state";

import code from "raw-loader!delisp/lib/prelude.dl";

const initialState: State = {
  code,
};

function AppWrapper() {
  const [state, dispatch] = useReducer(reducer, initialState);
  return <App state={state} dispatch={dispatch} />;
}

function render() {
  ReactDOM.render(<AppWrapper />, container);
}

const container = document.createElement("div");
document.body.appendChild(container);
render();

if (module.hot) {
  module.hot.accept("./App", () => {
    render();
  });
}

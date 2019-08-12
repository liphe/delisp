import React, { useReducer } from "react";
import ReactDOM from "react-dom";
import { App } from "./App";

import { State, reducer } from "./state";

const code = `
(define id (lambda (x) x))

((id id) 5)

(let {f (id id)}
  (f 5))

`;

const initialState: State = {
  code
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

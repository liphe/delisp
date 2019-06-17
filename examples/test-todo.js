const {
  initialState,
  reducer,
  addTodo,
  completeAll,
  showTodos
} = require("./.delisp/build/reducer.js");

let state = initialState;

state = reducer(state, addTodo("Write todo app!"));
state = reducer(state, completeAll());
state = reducer(state, addTodo("Complete more todos"));

showTodos(state);

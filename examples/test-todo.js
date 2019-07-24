const {
  initialState,
  reducer,
  addTodo,
  completeAll,
  showTodos
} = require("./.delisp/build/reducer.js");

let state = initialState;

const id = x => x;
const ctx = {};

state = reducer(id, ctx, state, addTodo(id, ctx, "Write todo app!"));
state = reducer(id, ctx, state, completeAll(id, ctx));
state = reducer(id, ctx, state, addTodo(id, ctx, "Complete more todos"));

showTodos(id, ctx, state);

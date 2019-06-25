const {
  initialState,
  reducer,
  addTodo,
  completeAll,
  showTodos
} = require("./.delisp/build/reducer.js");

let state = initialState;

const id = x => x;

state = reducer(id, state, addTodo(id, "Write todo app!"));
state = reducer(id, state, completeAll(id));
state = reducer(id, state, addTodo(id, "Complete more todos"));

showTodos(id, state);

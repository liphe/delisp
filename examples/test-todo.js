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

async function run() {
  state = await reducer(id, ctx, state, addTodo(id, ctx, "Write todo app!"));
  state = await reducer(id, ctx, state, completeAll(id, ctx));
  state = await reducer(
    id,
    ctx,
    state,
    addTodo(id, ctx, "Complete more todos")
  );

  await showTodos(id, ctx, state);
}

run();

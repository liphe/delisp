export interface State {
  code: string;
}

export type Action = { tag: "update-code"; value: string };

// Action creators

export const updateCode = (value: string): Action => ({
  tag: "update-code",
  value
});

// Reducer

export function reducer(state: State, action: Action) {
  switch (action.tag) {
    case "update-code":
      return { ...state, code: action.value };
    default:
      return state;
  }
}

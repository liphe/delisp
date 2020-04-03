import * as React from "react";
import { useContext } from "react";
import * as Delisp from "@delisp/core";

export const Context = React.createContext<
  ReturnType<typeof Delisp.createVariableNormalizer>
>(null as any);

export function useTypeNormalizer() {
  return useContext(Context);
}

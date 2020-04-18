import * as Delisp from "@delisp/core";
import * as React from "react";
import { useContext } from "react";

import styles from "./common.module.css";

export const Context = React.createContext<
  ReturnType<typeof Delisp.createVariableNormalizer>
>(null as any);

export function useTypeNormalizer() {
  return useContext(Context);
}

export const SExpr: React.FC<{ left: string; right: string }> = ({
  left,
  children,
  right,
}) => {
  return (
    <>
      <span className={styles.delimiter}>{left}</span>
      {children}
      <span className={styles.delimiter}>{right}</span>
    </>
  );
};

import * as Delisp from "@delisp/core";
import classnames from "classnames/bind";
import * as React from "react";
import { useContext } from "react";

import styles from "./common.module.css";

const cn = classnames.bind(styles);

export const Context = React.createContext<
  ReturnType<typeof Delisp.createVariableNormalizer>
>(null as any);

export function useTypeNormalizer() {
  return useContext(Context);
}

export const Keyword: React.FC<{ name: string }> = ({ name }) => {
  return <span className={styles.keyword}>{name}</span>;
};

export const SExpr: React.FC<{ left: string; right: string }> = ({
  left,
  children,
  right,
}) => {
  return (
    <>
      <span className={styles.delimiter}>{left}</span>
      <span className={styles.sexpr}>{children}</span>
      <span className={styles.delimiter}>{right}</span>
    </>
  );
};

export const SExprList: React.FC = ({ children }) => {
  return (
    <SExpr left="(" right=")">
      {children}
    </SExpr>
  );
};

export const SExprArray: React.FC = ({ children }) => {
  return (
    <SExpr left="[" right="]">
      {children}
    </SExpr>
  );
};

export const SExprMap: React.FC = ({ children }) => {
  return (
    <SExpr left="{" right="}">
      {children}
    </SExpr>
  );
};

export const Indent: React.FC<{ double?: boolean }> = ({
  double = false,
  children,
}) => {
  return <div className={cn("indent", { double })}>{children}</div>;
};

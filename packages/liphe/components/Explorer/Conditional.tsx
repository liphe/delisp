import * as Delisp from "@delisp/core";
import { Typed } from "@delisp/core";
import * as React from "react";
import { ExpressionExplorer } from "./Expression";
import styles from "./Conditional.module.css";

export const ConditionalExplorer: React.FC<{
  conditional: Delisp.SConditional<Typed>;
}> = ({ conditional }) => {
  return (
    <div className={styles.conditional}>
      <div className={styles.condition}>
        if <ExpressionExplorer expression={conditional.node.condition} />
      </div>
      <div className={styles.branches}>
        <fieldset className={styles.consequent}>
          <legend>then</legend>
          <ExpressionExplorer expression={conditional.node.consequent} />
        </fieldset>
        <fieldset className={styles.alternative}>
          <legend>else</legend>

          <ExpressionExplorer expression={conditional.node.alternative} />
        </fieldset>
      </div>
    </div>
  );
};

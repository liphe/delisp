import * as Delisp from "@delisp/core";
import { Typed } from "@delisp/core";
import * as React from "react";

import { Cursor } from "./common";
import styles from "./Conditional.module.css";
import { ExpressionExplorer } from "./Expression";

export const ConditionalExplorer: React.FC<{
  cursor: Cursor<Delisp.SConditional<Typed>>;
}> = ({ cursor }) => {
  return (
    <div className={styles.conditional}>
      <div className={styles.condition}>
        if <ExpressionExplorer cursor={cursor.prop("node").prop("condition")} />
      </div>
      <div className={styles.branches}>
        <fieldset className={styles.consequent}>
          <legend>then</legend>
          <ExpressionExplorer cursor={cursor.prop("node").prop("consequent")} />
        </fieldset>
        <fieldset className={styles.alternative}>
          <legend>else</legend>
          <ExpressionExplorer
            cursor={cursor.prop("node").prop("alternative")}
          />
        </fieldset>
      </div>
    </div>
  );
};

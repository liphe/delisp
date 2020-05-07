import * as Delisp from "@delisp/core";
import * as React from "react";

import { Extended } from "./common";
import { Keyword } from "./common";
import styles from "./Conditional.module.css";
import { ExpressionExplorer } from "./Expression";
import { Cursor } from "./utils/Cursor";

export const ConditionalExplorer: React.FC<{
  cursor: Cursor<Delisp.SConditional<Extended>>;
}> = ({ cursor }) => {
  return (
    <div className={styles.conditional}>
      <div className={styles.condition}>
        <Keyword name="if" />{" "}
        <ExpressionExplorer cursor={cursor.prop("node").prop("condition")} />
      </div>
      <div className={styles.branches}>
        <fieldset className={styles.consequent}>
          <legend>then</legend>
          <ExpressionExplorer cursor={cursor.prop("node").prop("consequent")} />
        </fieldset>
        <button
          onClick={() =>
            cursor.update({
              ...cursor.value,
              node: {
                ...cursor.value.node,
                consequent: cursor.value.node.alternative,
                alternative: cursor.value.node.consequent,
              },
            })
          }
        >
          ⇆
        </button>
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

import * as Delisp from "@delisp/core";
import * as React from "react";

import { Extended } from "./common";
import { ExpressionExplorer } from "./Expression";
import { IdentifierExplorer } from "./Identifier";
import styles from "./Record.module.css";
import { Cursor } from "./utils/Cursor";

export const RecordExplorer: React.FC<{
  cursor: Cursor<Delisp.SRecord<Extended>>;
}> = ({ cursor }) => {
  const fieldCursor = cursor.prop("node").prop("fields");
  return (
    <div className={styles.record}>
      {"{"}
      <ul>
        {Cursor.map(fieldCursor, (c) => {
          return (
            <li key={c.value.label.name}>
              <IdentifierExplorer cursor={c.prop("label")} />{" "}
              <ExpressionExplorer cursor={c.prop("value")} />
            </li>
          );
        })}
      </ul>
      {"}"}
    </div>
  );
};

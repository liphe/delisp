import * as Delisp from "@delisp/core";
import { Typed } from "@delisp/core";
import * as React from "react";

import { Cursor } from "./common";
import { IdentifierExplorer } from "./Identifier";
import styles from "./Record.module.css";
import { ExpressionExplorer } from "./Expression";

export const RecordExplorer: React.FC<{
  cursor: Cursor<Delisp.SRecord<Typed>>;
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

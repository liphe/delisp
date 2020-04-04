import * as Delisp from "@delisp/core";
import { Typed } from "@delisp/core";
import * as React from "react";

import { IdentifierExplorer } from "./Identifier";
import styles from "./Record.module.css";
import { SyntaxExplorer } from "./Syntax";

export const RecordExplorer: React.FC<{
  record: Delisp.SRecord<Typed>;
}> = ({ record }) => {
  return (
    <div className={styles.record}>
      {"{"}
      <ul>
        {record.node.fields.map((field) => {
          return (
            <li key={field.label.name}>
              <IdentifierExplorer identifier={field.label} />{" "}
              <SyntaxExplorer syntax={field.value} />
            </li>
          );
        })}
      </ul>
      {"}"}
    </div>
  );
};

import * as Delisp from "@delisp/core";
import { Typed } from "@delisp/core";
import classnames from "classnames/bind";
import * as React from "react";

import { Cursor } from "./common";
import { ExpressionExplorer } from "./Expression";
import styles from "./FunctionCall.module.css";

const cn = classnames.bind(styles);

export const FunctionCallExplorer: React.FC<{
  cursor: Cursor<Delisp.SFunctionCall<Typed>>;
}> = ({ cursor }) => {
  const call = cursor.value;
  const argCursor = Cursor.slice(cursor.prop("node").prop("arguments"), 1);
  return (
    <div className={styles.functionCall}>
      <div className={styles.function}>
        <ExpressionExplorer cursor={cursor.prop("node").prop("fn")} />
      </div>
      <div
        className={cn("argumentList", {
          longList: call.node.arguments.length > 5,
        })}
      >
        {Cursor.map(argCursor, (c, ix) => {
          return (
            <div className={cn("argument")} key={ix}>
              <ExpressionExplorer cursor={c} />
            </div>
          );
        })}
      </div>
    </div>
  );
};

import * as Delisp from "@delisp/core";
import { Typed } from "@delisp/core";
import * as React from "react";
import { ExpressionExplorer } from "./Expression";
import styles from "./FunctionCall.module.css";
import classnames from "classnames/bind";

const cn = classnames.bind(styles);

export const FunctionCallExplorer: React.FC<{
  call: Delisp.SFunctionCall<Typed>;
}> = ({ call }) => {
  return (
    <div className={styles.functionCall}>
      <div className={styles.function}>
        <ExpressionExplorer expression={call.node.fn} />
      </div>
      <div
        className={cn("argumentList", {
          longList: call.node.arguments.length > 5,
        })}
      >
        {call.node.arguments.slice(1).map((arg, ix) => {
          return (
            <div className={cn("argument")}>
              <ExpressionExplorer key={ix} expression={arg} />
            </div>
          );
        })}
      </div>
    </div>
  );
};

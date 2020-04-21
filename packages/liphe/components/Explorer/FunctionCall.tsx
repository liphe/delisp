import * as Delisp from "@delisp/core";
import { Typed } from "@delisp/core";
// import classnames from "classnames/bind";
import * as React from "react";

import { SExprList } from "./common";
import { ExpressionExplorer } from "./Expression";
import { Cursor } from "./utils/Cursor";

// const cn = classnames.bind(styles);

export const FunctionCallExplorer: React.FC<{
  cursor: Cursor<Delisp.SFunctionCall<Typed>>;
}> = ({ cursor }) => {
  const argCursor = Cursor.slice(cursor.prop("node").prop("arguments"), 1);
  return (
    <SExprList>
      <ExpressionExplorer cursor={cursor.prop("node").prop("fn")} />
      {Cursor.map(argCursor, (c, ix) => (
        <ExpressionExplorer key={ix} cursor={c} />
      ))}
    </SExprList>
  );
};

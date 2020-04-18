import * as Delisp from "@delisp/core";
import { Typed } from "@delisp/core";
import * as React from "react";

import { Keyword, SExprList } from "./common";
import { ExpressionExplorer } from "./Expression";
import { Cursor } from "./utils/Cursor";

export const ValuesExplorer: React.FC<{
  cursor: Cursor<Delisp.SValues<Typed>>;
}> = ({ cursor }) => {
  return (
    <SExprList>
      <Keyword name="values" />
      {Cursor.map(cursor.prop("node").prop("values"), (value) => {
        return <ExpressionExplorer cursor={value} />;
      })}
    </SExprList>
  );
};

import * as Delisp from "@delisp/core";
import * as React from "react";

import { Extended } from "./common";
import { Keyword, SExprList } from "./common";
import { ExpressionExplorer } from "./Expression";
import { Cursor } from "./utils/Cursor";

export const ValuesExplorer: React.FC<{
  cursor: Cursor<Delisp.SValues<Extended>>;
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

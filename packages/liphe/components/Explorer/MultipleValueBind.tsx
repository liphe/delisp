import * as Delisp from "@delisp/core";
import * as React from "react";

import { Extended } from "./common";
import { Indent, Keyword, SExprList } from "./common";
import { ExpressionExplorer } from "./Expression";
import { IdentifierExplorer } from "./Identifier";
import { Cursor } from "./utils/Cursor";

export const MultipleValueBindExplorer: React.FC<{
  cursor: Cursor<Delisp.SMultipleValueBind<Extended>>;
}> = ({ cursor }) => {
  return (
    <SExprList>
      <Keyword name="multiple-value-bind" />
      <SExprList>
        {Cursor.map(cursor.prop("node").prop("variables"), (v) => {
          return <IdentifierExplorer key={v.value.name} cursor={v} />;
        })}
      </SExprList>

      <Indent double>
        <ExpressionExplorer cursor={cursor.prop("node").prop("form")} />
      </Indent>

      <Indent>
        {Cursor.map(cursor.prop("node").prop("body"), (expr, i) => {
          return <ExpressionExplorer key={i} cursor={expr} />;
        })}
      </Indent>
    </SExprList>
  );
};

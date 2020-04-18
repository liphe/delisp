import * as Delisp from "@delisp/core";
import { Typed } from "@delisp/core";
import * as React from "react";

import { Context, Keyword, SExprList } from "./common";
import { ExpressionExplorer } from "./Expression";
import { TypeExplorer } from "./Type";
import { Cursor } from "./utils/Cursor";

export const TypeAnnotationExplorer: React.FC<{
  cursor: Cursor<Delisp.STypeAnnotation<Typed>>;
}> = ({ cursor }) => {
  const noNormalizer = (x: Delisp.T.Var) => x.node.name;
  return (
    <SExprList>
      <Keyword name="the" />
      <Context.Provider value={noNormalizer}>
        <TypeExplorer type={cursor.value.node.typeWithWildcards.asRawType()} />
      </Context.Provider>
      <ExpressionExplorer cursor={cursor.prop("node").prop("value")} />
    </SExprList>
  );
};

import * as Delisp from "@delisp/core";
import { Typed } from "@delisp/core";
import * as React from "react";

import { Keyword, ListExplorer } from "./common";
import { ExpressionExplorer } from "./Expression";
import { TypeExplorer } from "./Type";
import { Cursor } from "./utils/Cursor";

export const TypeAnnotationExplorer: React.FC<{
  cursor: Cursor<Delisp.STypeAnnotation<Typed>>;
}> = ({ cursor }) => {
  return (
    <ListExplorer>
      <Keyword name="the" />
      <TypeExplorer type={cursor.value.node.typeWithWildcards.asRawType()} />
      <ExpressionExplorer cursor={cursor.prop("node").prop("value")} />
    </ListExplorer>
  );
};

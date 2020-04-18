import * as Delisp from "@delisp/core";
import { Typed } from "@delisp/core";
import * as React from "react";

import { GenericSyntaxExplorer } from "../PPrinter";
import { useTypeNormalizer } from "./common";
import { DefinitionExplorer } from "./Definition";
import { ExpressionExplorer } from "./Expression";
import { Cursor } from "./utils/Cursor";

export const SyntaxExplorer: React.FC<{
  cursor: Cursor<Delisp.Syntax<Typed>>;
}> = ({ cursor }) => {
  const syntax = cursor.value;
  const normalizer = useTypeNormalizer();
  const content = Delisp.isExpression(syntax) ? (
    <ExpressionExplorer cursor={cursor as Cursor<Delisp.Expression<Typed>>} />
  ) : Delisp.isDefinition(syntax) ? (
    <DefinitionExplorer cursor={cursor as Cursor<Delisp.SDefinition<Typed>>} />
  ) : (
    <GenericSyntaxExplorer syntax={syntax} normalizer={normalizer} />
  );
  return <div>{content}</div>;
};

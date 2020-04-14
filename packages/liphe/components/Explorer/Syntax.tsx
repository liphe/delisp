import * as Delisp from "@delisp/core";
import { Typed } from "@delisp/core";
import * as React from "react";

import { GenericSyntaxExplorer } from "../PPrinter";
import { useTypeNormalizer, Cursor } from "./common";
import { ExpressionExplorer } from "./Expression";
import { DefinitionExplorer } from "./Definition";

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

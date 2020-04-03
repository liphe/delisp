import * as React from "react";
import * as Delisp from "@delisp/core";
import { Typed } from "@delisp/core";
import { useTypeNormalizer } from "./common";
import { GenericSyntaxExplorer } from "../PPrinter";
import { ExpressionExplorer } from "./Expression";

export const SyntaxExplorer: React.FC<{ syntax: Delisp.Syntax<Typed> }> = ({
  syntax,
}) => {
  const normalizer = useTypeNormalizer();
  const content = Delisp.isExpression(syntax) ? (
    <ExpressionExplorer expression={syntax} />
  ) : (
    <GenericSyntaxExplorer syntax={syntax} normalizer={normalizer} />
  );
  return <div>{content}</div>;
};

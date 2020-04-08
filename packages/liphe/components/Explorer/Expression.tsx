import * as Delisp from "@delisp/core";
import { Typed } from "@delisp/core";
import * as React from "react";

import { GenericSyntaxExplorer } from "../PPrinter";
import { BooleanExplorer } from "./Boolean";
import { useTypeNormalizer } from "./common";
import { FunctionExplorer } from "./Function";
import { FunctionCallExplorer } from "./FunctionCall";
import { NoneExplorer } from "./None";
import { NumberExplorer } from "./Number";
import { RecordExplorer } from "./Record";
import { StringExplorer } from "./String";

export const ExpressionExplorer: React.FC<{
  expression: Delisp.Expression<Typed>;
}> = ({ expression }) => {
  switch (expression.node.tag) {
    case "number":
      return (
        <NumberExplorer value={{ ...expression, node: expression.node }} />
      );
    case "string":
      return (
        <StringExplorer value={{ ...expression, node: expression.node }} />
      );
    case "none":
      return <NoneExplorer value={{ ...expression, node: expression.node }} />;
    case "boolean":
      return (
        <BooleanExplorer value={{ ...expression, node: expression.node }} />
      );
    case "function":
      return <FunctionExplorer fn={{ ...expression, node: expression.node }} />;
    case "record":
      return (
        <RecordExplorer record={{ ...expression, node: expression.node }} />
      );
    case "function-call":
      return (
        <FunctionCallExplorer call={{ ...expression, node: expression.node }} />
      );
    default: {
      const normalizer = useTypeNormalizer();
      return (
        <GenericSyntaxExplorer syntax={expression} normalizer={normalizer} />
      );
    }
  }
};

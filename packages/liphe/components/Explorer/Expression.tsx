import * as Delisp from "@delisp/core";
import { Typed } from "@delisp/core";
import * as React from "react";

import { GenericSyntaxExplorer } from "../PPrinter";
import { BooleanExplorer } from "./Boolean";
import { Cursor, useTypeNormalizer } from "./common";
import { ConditionalExplorer } from "./Conditional";
import { FunctionExplorer } from "./Function";
import { FunctionCallExplorer } from "./FunctionCall";
import { NoneExplorer } from "./None";
import { NumberExplorer } from "./Number";
import { RecordExplorer } from "./Record";
import { StringExplorer } from "./String";
import { VariableReferenceExplorer } from "./VariableReference";

export const ExpressionExplorer: React.FC<{
  cursor: Cursor<Delisp.Expression<Typed>>;
}> = ({ cursor }) => {
  const expression = cursor.value;
  switch (expression.node.tag) {
    case "number":
      return (
        <NumberExplorer cursor={cursor as Cursor<Delisp.SNumber<Typed>>} />
      );
    case "string":
      return (
        <StringExplorer cursor={cursor as Cursor<Delisp.SString<Typed>>} />
      );
    case "none":
      return <NoneExplorer cursor={cursor as Cursor<Delisp.SNone<Typed>>} />;
    case "boolean":
      return (
        <BooleanExplorer cursor={cursor as Cursor<Delisp.SBoolean<Typed>>} />
      );
    case "function":
      return (
        <FunctionExplorer cursor={cursor as Cursor<Delisp.SFunction<Typed>>} />
      );
    case "record":
      return (
        <RecordExplorer cursor={cursor as Cursor<Delisp.SRecord<Typed>>} />
      );
    case "function-call":
      return (
        <FunctionCallExplorer
          cursor={cursor as Cursor<Delisp.SFunctionCall<Typed>>}
        />
      );
    case "variable-reference":
      return (
        <VariableReferenceExplorer
          cursor={cursor as Cursor<Delisp.SVariableReference<Typed>>}
        />
      );
    case "conditional":
      return (
        <ConditionalExplorer
          cursor={cursor as Cursor<Delisp.SConditional<Typed>>}
        />
      );

    default: {
      const normalizer = useTypeNormalizer();
      return (
        <GenericSyntaxExplorer syntax={expression} normalizer={normalizer} />
      );
    }
  }
};

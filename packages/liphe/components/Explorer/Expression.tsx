import * as Delisp from "@delisp/core";
import * as React from "react";

import { GenericSyntaxExplorer } from "../PPrinter";
import { BooleanExplorer } from "./Boolean";
import { Extended } from "./common";
import { useTypeNormalizer } from "./common";
import { ConditionalExplorer } from "./Conditional";
import { FunctionExplorer } from "./Function";
import { FunctionCallExplorer } from "./FunctionCall";
import { LetExplorer } from "./Let";
import { MultipleValueBindExplorer } from "./MultipleValueBind";
import { NoneExplorer } from "./None";
import { NumberExplorer } from "./Number";
import { RecordExplorer } from "./Record";
import { StringExplorer } from "./String";
import { TypeAnnotationExplorer } from "./TypeAnnotation";
import { Cursor } from "./utils/Cursor";
import { ValuesExplorer } from "./Values";
import { VariableReferenceExplorer } from "./VariableReference";

export const ExpressionExplorer: React.FC<{
  cursor: Cursor<Delisp.Expression<Extended>>;
}> = ({ cursor }) => {
  const expression = cursor.value;
  switch (expression.node.tag) {
    case "number":
      return (
        <NumberExplorer cursor={cursor as Cursor<Delisp.SNumber<Extended>>} />
      );
    case "string":
      return (
        <StringExplorer cursor={cursor as Cursor<Delisp.SString<Extended>>} />
      );
    case "none":
      return <NoneExplorer cursor={cursor as Cursor<Delisp.SNone<Extended>>} />;
    case "boolean":
      return (
        <BooleanExplorer cursor={cursor as Cursor<Delisp.SBoolean<Extended>>} />
      );
    case "function":
      return (
        <FunctionExplorer
          cursor={cursor as Cursor<Delisp.SFunction<Extended>>}
        />
      );
    case "record":
      return (
        <RecordExplorer cursor={cursor as Cursor<Delisp.SRecord<Extended>>} />
      );
    case "function-call":
      return (
        <FunctionCallExplorer
          cursor={cursor as Cursor<Delisp.SFunctionCall<Extended>>}
        />
      );
    case "variable-reference":
      return (
        <VariableReferenceExplorer
          cursor={cursor as Cursor<Delisp.SVariableReference<Extended>>}
        />
      );
    case "conditional":
      return (
        <ConditionalExplorer
          cursor={cursor as Cursor<Delisp.SConditional<Extended>>}
        />
      );
    case "type-annotation":
      return (
        <TypeAnnotationExplorer
          cursor={cursor as Cursor<Delisp.STypeAnnotation<Extended>>}
        />
      );
    case "values":
      return (
        <ValuesExplorer cursor={cursor as Cursor<Delisp.SValues<Extended>>} />
      );
    case "multiple-value-bind":
      return (
        <MultipleValueBindExplorer
          cursor={cursor as Cursor<Delisp.SMultipleValueBind<Extended>>}
        />
      );
    case "let-bindings":
      return <LetExplorer cursor={cursor as Cursor<Delisp.SLet<Extended>>} />;

    default: {
      const normalizer = useTypeNormalizer();
      return (
        <GenericSyntaxExplorer syntax={expression} normalizer={normalizer} />
      );
    }
  }
};

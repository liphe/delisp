import * as Delisp from "@delisp/core";
import { Typed } from "@delisp/core";
import * as React from "react";

import { GenericSyntaxExplorer } from "../PPrinter";
import { BooleanExplorer } from "./Boolean";
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
    case "type-annotation":
      return (
        <TypeAnnotationExplorer
          cursor={cursor as Cursor<Delisp.STypeAnnotation<Typed>>}
        />
      );
    case "values":
      return (
        <ValuesExplorer cursor={cursor as Cursor<Delisp.SValues<Typed>>} />
      );
    case "multiple-value-bind":
      return (
        <MultipleValueBindExplorer
          cursor={cursor as Cursor<Delisp.SMultipleValueBind<Typed>>}
        />
      );
    case "let-bindings":
      return <LetExplorer cursor={cursor as Cursor<Delisp.SLet<Typed>>} />;

    default: {
      const normalizer = useTypeNormalizer();
      return (
        <GenericSyntaxExplorer syntax={expression} normalizer={normalizer} />
      );
    }
  }
};

import * as Delisp from "@delisp/core";
import { Typed } from "@delisp/core";
import * as React from "react";
import { useTypeNormalizer } from "./common";

export const VariableReferenceExplorer: React.FC<{
  variable: Delisp.SVariableReference<Typed>;
}> = ({ variable }) => {
  const normalizer = useTypeNormalizer();
  const varType = Delisp.printTypeWithNormalizer(
    variable.info.selfType,
    normalizer
  );

  return (
    <span style={{ color: "#00aa00" }} title={varType}>
      {variable.node.name}
    </span>
  );
};

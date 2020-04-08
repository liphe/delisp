import * as Delisp from "@delisp/core";
import * as React from "react";

export const BooleanExplorer: React.FC<{ value: Delisp.SBoolean }> = ({
  value,
}) => {
  return <span>{value.node.value ? "true" : "false"}</span>;
};

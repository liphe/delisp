import * as Delisp from "@delisp/core";
import * as React from "react";

export const StringExplorer: React.FC<{ value: Delisp.SString }> = ({
  value,
}) => {
  return <span>&quot;{value.node.value}&quot;</span>;
};

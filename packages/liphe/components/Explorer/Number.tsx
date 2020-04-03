import * as React from "react";
import * as Delisp from "@delisp/core";

export const NumberExplorer: React.FC<{ value: Delisp.SNumber }> = ({
  value,
}) => {
  const n = value.node.value;
  return (
    <span title={`{n} = 0x${n.toString(16)} = b${n.toString(2)}`}>{n}</span>
  );
};

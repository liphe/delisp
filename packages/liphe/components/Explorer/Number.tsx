import * as Delisp from "@delisp/core";
import { Typed } from "@delisp/core";
import * as React from "react";
import { Cursor } from "./common";

export const NumberExplorer: React.FC<{
  cursor: Cursor<Delisp.SNumber<Typed>>;
}> = ({ cursor }) => {
  const n = cursor.value.node.value;
  const inc = () =>
    cursor.update({
      ...cursor.value,
      node: { ...cursor.value.node, value: n + 1 },
    });
  return (
    <span title={`{n} = 0x${n.toString(16)} = b${n.toString(2)}`} onClick={inc}>
      {n}
    </span>
  );
};

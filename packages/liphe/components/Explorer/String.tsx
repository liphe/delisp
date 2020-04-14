import * as Delisp from "@delisp/core";
import { Typed } from "@delisp/core";
import * as React from "react";
import { Cursor } from "./common";

export const StringExplorer: React.FC<{
  cursor: Cursor<Delisp.SString<Typed>>;
}> = ({ cursor }) => {
  const str = cursor.value.node.value;
  const updateString = () => {
    cursor.update({
      ...cursor.value,
      node: {
        ...cursor.value.node,
        value: window.prompt("New string:", str) || str,
      },
    });
  };

  return <span onClick={updateString}>&quot;{str}&quot;</span>;
};

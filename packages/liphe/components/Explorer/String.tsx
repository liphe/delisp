import * as Delisp from "@delisp/core";
import { Typed } from "@delisp/core";
import * as React from "react";
import { Cursor } from "./common";

export const StringExplorer: React.FC<{
  cursor: Cursor<Delisp.SString<Typed>>;
}> = ({ cursor }) => {
  return <span>&quot;{cursor.value.node.value}&quot;</span>;
};

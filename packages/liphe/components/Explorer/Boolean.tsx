import * as Delisp from "@delisp/core";
import { Typed } from "@delisp/core";
import * as React from "react";
import { Cursor } from "./common";

export const BooleanExplorer: React.FC<{
  cursor: Cursor<Delisp.SBoolean<Typed>>;
}> = ({ cursor }) => {
  return <span>{cursor.value.node.value ? "true" : "false"}</span>;
};

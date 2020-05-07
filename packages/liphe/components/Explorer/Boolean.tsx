import * as Delisp from "@delisp/core";
import * as React from "react";

import { Extended } from "./common";
import { Cursor } from "./utils/Cursor";

export const BooleanExplorer: React.FC<{
  cursor: Cursor<Delisp.SBoolean<Extended>>;
}> = ({ cursor }) => {
  return <span>{cursor.value.node.value ? "true" : "false"}</span>;
};

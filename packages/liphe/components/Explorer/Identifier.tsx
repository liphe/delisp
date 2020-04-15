import * as Delisp from "@delisp/core";
import * as React from "react";

import { Cursor } from "./common";

export const IdentifierExplorer: React.FC<{
  cursor: Cursor<Delisp.Identifier>;
}> = ({ cursor }) => {
  return (
    <code>
      <span style={{ color: "#0000aa" }}>{cursor.value.name}</span>
    </code>
  );
};

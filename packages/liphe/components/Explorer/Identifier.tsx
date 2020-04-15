import * as Delisp from "@delisp/core";
import * as React from "react";

export const IdentifierExplorer: React.FC<{
  identifier: Delisp.Identifier;
}> = ({ identifier }) => {
  return (
    <code>
      <span style={{ color: "#0000aa" }}>{identifier.name}</span>
    </code>
  );
};

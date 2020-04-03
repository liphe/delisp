import * as Delisp from "@delisp/core";
import * as React from "react";

export const IdentifierExplorer: React.FC<{
  identifier: Delisp.Identifier;
}> = ({ identifier }) => {
  return (
    <code>
      <span>{identifier.name}</span>
    </code>
  );
};

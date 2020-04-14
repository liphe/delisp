import * as Delisp from "@delisp/core";
import { Typed } from "@delisp/core";
import { Cursor } from "./common";
import * as React from "react";

export const NoneExplorer: React.FC<{
  cursor: Cursor<Delisp.SNone<Typed>>;
}> = () => {
  return <span>none</span>;
};

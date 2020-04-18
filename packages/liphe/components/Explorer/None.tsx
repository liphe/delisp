import * as Delisp from "@delisp/core";
import { Typed } from "@delisp/core";
import * as React from "react";

import { Cursor } from "./utils/Cursor";

export const NoneExplorer: React.FC<{
  cursor: Cursor<Delisp.SNone<Typed>>;
}> = () => {
  return <span>none</span>;
};

import * as Delisp from "@delisp/core";
import * as React from "react";

import { Extended } from "./common";
import { Cursor } from "./utils/Cursor";

export const NoneExplorer: React.FC<{
  cursor: Cursor<Delisp.SNone<Extended>>;
}> = () => {
  return <span>none</span>;
};

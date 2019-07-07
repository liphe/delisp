import * as T from "./types";

let generateUniqueTVarIdx = 0;
export const generateUniqueTVar = (
  userSpecified = false,
  prefix = "t"
): T.Var => T.var(`${prefix}${++generateUniqueTVarIdx}`, userSpecified);

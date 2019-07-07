import { tVar, Var } from "./types";

let generateUniqueTVarIdx = 0;
export const generateUniqueTVar = (userSpecified = false, prefix = "t"): Var =>
  tVar(`${prefix}${++generateUniqueTVarIdx}`, userSpecified);

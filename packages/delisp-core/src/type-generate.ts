import { tVar, TVar } from "./types";

let generateUniqueTVarIdx = 0;
export const generateUniqueTVar = (userSpecified = false, prefix = "t"): TVar =>
  tVar(`${prefix}${++generateUniqueTVarIdx}`, userSpecified);

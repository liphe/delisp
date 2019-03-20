import { transformRecurType } from "./type-utils";
import { Monotype } from "./types";

export interface Substitution {
  [t: string]: Monotype;
}

export function applySubstitution(t: Monotype, env: Substitution): Monotype {
  return transformRecurType(t, t1 => {
    if (t1.type === "type-variable") {
      if (t1.name in env) {
        const tt = env[t1.name];
        return applySubstitution(tt, env);
      } else {
        return t1;
      }
    } else {
      return t1;
    }
  });
}

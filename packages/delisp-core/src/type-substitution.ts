import { Monotype } from "./types";

export interface Substitution {
  [t: string]: Monotype;
}

export function applySubstitution(t: Monotype, env: Substitution): Monotype {
  switch (t.type) {
    case "number":
    case "string":
      return t;
    case "application":
      return {
        type: "application",
        op: t.op,
        args: t.args.map(t1 => applySubstitution(t1, env))
      };
    case "type-variable": {
      if (t.name in env) {
        const tt = env[t.name];
        return applySubstitution(tt, env);
      } else {
        return t;
      }
    }
  }
}

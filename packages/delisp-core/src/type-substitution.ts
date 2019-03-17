import { Monotype, tApp, tRowExtension } from "./types";

export interface Substitution {
  [t: string]: Monotype;
}

export function applySubstitution(t: Monotype, env: Substitution): Monotype {
  switch (t.type) {
    case "void":
    case "boolean":
    case "number":
    case "string":
      return t;
    case "application":
      return tApp(t.op, ...t.args.map(t1 => applySubstitution(t1, env)));
    case "type-variable": {
      if (t.name in env) {
        const tt = env[t.name];
        return applySubstitution(tt, env);
      } else {
        return t;
      }
    }
    case "user-defined-type":
      return t;
    case "empty-row":
      return t;
    case "row-extension":
      return tRowExtension(
        t.label,
        applySubstitution(t.labelType, env),
        applySubstitution(t.extends, env)
      );
  }
}

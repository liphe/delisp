import { Substitution } from "./type-substitution";
import { printType } from "./type-utils";
import { Monotype, TVar } from "./types";

function occurCheck(v: TVar, rootT: Monotype) {
  function check(t: Monotype) {
    if (t.type === "type-variable" && t.name === v.name) {
      throw new Error(
        `The variable '${v.name}' cannot be part of ${printType(rootT)}`
      );
    }
    if (t.type === "application") {
      t.args.forEach(check);
    }
    return;
  }

  return check(rootT);
}

function unifyVariable(v: TVar, t: Monotype, env: Substitution): Substitution {
  if (v.name in env) {
    return unify(env[v.name], t, env);
  }
  if (t.type === "type-variable") {
    if (v.name === t.name) {
      return env;
    } else if (t.name in env) {
      return unifyVariable(v, env[t.name], env);
    } else {
      return { ...env, [v.name]: t };
    }
  } else {
    occurCheck(v, t);
    return { ...env, [v.name]: t };
  }
}

function unifyArray(
  t1s: Monotype[],
  t2s: Monotype[],
  env: Substitution
): Substitution {
  if (t1s.length === 0 && t2s.length === 0) {
    return env;
  } else {
    const [t1, ...rest1] = t1s;
    const [t2, ...rest2] = t2s;
    const s = unify(t1, t2, env);
    return unifyArray(rest1, rest2, s);
  }
}

export function unify(
  t1: Monotype,
  t2: Monotype,
  env: Substitution = {}
): Substitution {
  if (t1.type === "string" && t2.type === "string") {
    return env;
  } else if (t1.type === "number" && t2.type === "number") {
    return env;
  } else if (t1.type === "application" && t2.type === "application") {
    return unifyArray(t1.args, t2.args, env);
  } else if (t1.type === "type-variable") {
    return unifyVariable(t1, t2, env);
  } else if (t2.type === "type-variable") {
    return unifyVariable(t2, t1, env);
  } else {
    throw new Error("Couldnt unify");
  }
}

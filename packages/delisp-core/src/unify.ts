import { printType, TFunction, TNumber, TString, TVar, Type } from "./types";

interface Substitution {
  [t: string]: Type;
}

function applySubstitution(t: Type, env: Substitution): Type {
  switch (t.type) {
    case "number":
    case "string":
      return t;
    case "function":
      return {
        type: "function",
        from: t.from.map(t1 => applySubstitution(t1, env)),
        to: applySubstitution(t.to, env)
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

function occurCheck(v: TVar, rootT: Type) {
  function check(t: Type) {
    if (t.type === "type-variable" && t.name === v.name) {
      throw new Error(
        `The variable '${v.name}' cannot be part of ${printType(rootT)}`
      );
    }
    if (t.type === "function") {
      t.from.forEach(check);
      [t.to].forEach(check);
    }
    return;
  }

  return check(rootT);
}

function unifyVariable(v: TVar, t: Type, env: Substitution): Substitution {
  if (t.type !== "type-variable") {
    occurCheck(v, t);
    return { ...env, [v.name]: t };
  } else {
    if (v.name === t.name) {
      return env;
    } else {
      if (v.name in env) {
        return unifyVariable(t, env[v.name], env);
      }
      if (t.name in env) {
        return unifyVariable(v, env[t.name], env);
      }
      return { ...env, [v.name]: t };
    }
  }
}

function unifyArray(t1s: Type[], t2s: Type[], env: Substitution): Substitution {
  if (t1s.length === 0 && t2s.length === 0) {
    return env;
  } else {
    const [t1, ...rest1] = t1s;
    const [t2, ...rest2] = t2s;
    const s = unify(t1, t2, env);
    return unifyArray(rest1, rest2, s);
  }
}

function unify(t1: Type, t2: Type, env: Substitution = {}): Substitution {
  if (t1.type === "string" && t2.type === "string") {
    return env;
  } else if (t1.type === "number" && t2.type === "number") {
    return env;
  } else if (t1.type === "function" && t2.type === "function") {
    return unifyArray([...t1.from, t1.to], [...t2.from, t2.to], env);
  } else if (t1.type === "type-variable") {
    return unifyVariable(t1, t2, env);
  } else if (t2.type === "type-variable") {
    return unifyVariable(t2, t1, env);
  } else {
    throw new Error("Couldnt unify");
  }
}

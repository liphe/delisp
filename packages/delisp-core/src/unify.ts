import { Substitution } from "./type-substitution";
import { printType } from "./type-utils";
import { Monotype, TVar } from "./types";

interface UnifySuccess {
  type: "unify-success";
  substitution: Substitution;
}

interface UnifyOccurCheckError {
  type: "unify-occur-check-error";
  variable: TVar;
  t: Monotype;
}

interface UnifyMismatchError {
  type: "unify-mismatch-error";
  t1: Monotype;
  t2: Monotype;
}

type UnifyError = UnifyOccurCheckError | UnifyMismatchError;
type UnifyResult = UnifySuccess | UnifyError;

function success(s: Substitution): UnifyResult {
  return {
    type: "unify-success",
    substitution: s
  };
}

function occurCheck(v: TVar, rootT: Monotype): UnifyError | null {
  function check(t: Monotype) {
    if (t.type === "type-variable" && t.name === v.name) {
      const err: UnifyOccurCheckError = {
        type: "unify-occur-check-error",
        variable: v,
        t: rootT
      };
      return err;
    }
    if (t.type === "application") {
      t.args.forEach(check);
    }
    return null;
  }
  return check(rootT);
}

function unifyVariable(v: TVar, t: Monotype, ctx: Substitution): UnifyResult {
  if (v.name in ctx) {
    return unify(ctx[v.name], t, ctx);
  }
  if (t.type === "type-variable") {
    if (v.name === t.name) {
      return success(ctx);
    } else if (t.name in ctx) {
      return unifyVariable(v, ctx[t.name], ctx);
    } else {
      return success({ ...ctx, [v.name]: t });
    }
  } else {
    const err = occurCheck(v, t);
    if (err) {
      return err;
    } else {
      return success({ ...ctx, [v.name]: t });
    }
  }
}

function unifyArray(
  t1s: Monotype[],
  t2s: Monotype[],
  ctx: Substitution
): UnifyResult {
  if (t1s.length === 0 && t2s.length === 0) {
    return success(ctx);
  } else {
    const [t1, ...rest1] = t1s;
    const [t2, ...rest2] = t2s;
    const result = unify(t1, t2, ctx);
    if (result.type === "unify-success") {
      return unifyArray(rest1, rest2, result.substitution);
    } else {
      return result;
    }
  }
}

export function unify(
  t1: Monotype,
  t2: Monotype,
  ctx: Substitution = {}
): UnifyResult {
  if (t1.type === "string" && t2.type === "string") {
    return success(ctx);
  } else if (t1.type === "number" && t2.type === "number") {
    return success(ctx);
  } else if (t1.type === "boolean" && t2.type === "boolean") {
    return success(ctx);
  } else if (t1.type === "application" && t2.type === "application") {
    return unifyArray(t1.args, t2.args, ctx);
  } else if (t1.type === "type-variable") {
    return unifyVariable(t1, t2, ctx);
  } else if (t2.type === "type-variable") {
    return unifyVariable(t2, t1, ctx);
  } else {
    throw new Error(`Couldnt unify
${printType(t1)}

with

${printType(t2)}
`);
  }
}

export function unifyOrError(
  t1: Monotype,
  t2: Monotype,
  ctx: Substitution = {}
): UnifySuccess {
  const result = unify(t1, t2, ctx);
  if (result.type === "unify-success") {
    return result;
  } else {
    throw new Error(`Couldnt unify
${printType(t1)}

with

${printType(t2)}
`);
  }
}

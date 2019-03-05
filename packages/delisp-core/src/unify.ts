import { Substitution } from "./type-substitution";
import { generateUniqueTVar } from "./type-utils";
import { Monotype, RExtension, tRowExtension, TVar } from "./types";

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

function occurCheck(v: TVar, rootT: Monotype): UnifyOccurCheckError | null {
  function check(t: Monotype): UnifyOccurCheckError | null {
    if (t.type === "type-variable" && t.name === v.name) {
      const err: UnifyOccurCheckError = {
        type: "unify-occur-check-error",
        variable: v,
        t: rootT
      };
      return err;
    }
    if (t.type === "application") {
      const errors = t.args.map(check).filter(r => r !== null);
      return errors.length > 0 ? errors[0] : null;
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

function unifyRowWithLabel(
  row: Monotype,
  label: string,
  ctx: Substitution
): { row: RExtension; substitution: Substitution } {
  if (row.type === "type-variable") {
    const gamma = generateUniqueTVar();
    const beta = generateUniqueTVar();
    const theta = tRowExtension(beta, label, gamma);
    return {
      row: theta,
      substitution: { ...ctx, [row.name]: theta }
    };
  } else if (row.type === "row-extension") {
    if (row.label === label) {
      return {
        row,
        substitution: ctx
      };
    } else {
      const { row: newRow, substitution: subs } = unifyRowWithLabel(
        row.extends,
        label,
        ctx
      );
      return {
        row: tRowExtension(
          tRowExtension(newRow.extends, row.label, row.labelType),
          label,
          newRow.labelType
        ),
        substitution: subs
      };
    }
  } else {
    throw new Error("Should not get here");
  }
}

function unifyRow(
  row1: RExtension,
  row2: RExtension,
  ctx: Substitution
): UnifyResult {
  const { substitution: subs, row: r3 } = unifyRowWithLabel(
    row2,
    row1.label,
    ctx
  );
  return unifyArray(
    [row1.labelType, row1.extends],
    [r3.labelType, r3.extends],
    subs
  );
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
  } else if (t1.type === "empty-row" && t2.type === "empty-row") {
    return success(ctx);
  } else if (t1.type === "row-extension" && t2.type === "row-extension") {
    return unifyRow(t1, t2, ctx);
  } else {
    return {
      type: "unify-mismatch-error",
      t1,
      t2
    };
  }
}

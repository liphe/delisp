/**
 * Unification
 *
 * Basic unification based on Robinson's algorithm extended with
 * unification of row types as described in
 *
 *     Extensible records with scoped labels  (Daan Leijen)
 *
 * We use terminology and reference that paper through the
 * implementation. For example, you can search for "RULE".
 *
 * The `unify` function is the main entry-point for this module.
 */

import { generateUniqueTVar } from "./type-generate";
import { isTVar, Substitution } from "./type-utils";
import * as T from "./types";

interface UnifySuccess {
  tag: "unify-success";
  substitution: Substitution;
}

interface UnifyOccurCheckError {
  tag: "unify-occur-check-error";
  variable: T.TVar;
  t: T.Type;
}

interface UnifyMismatchError {
  tag: "unify-mismatch-error";
  t1: T.Type;
  t2: T.Type;
}

interface UnifyMissingValueError {
  tag: "unify-missing-value-error";
  t: T.Type;
}

type UnifyError =
  | UnifyOccurCheckError
  | UnifyMismatchError
  | UnifyMissingValueError;
type UnifyResult = UnifySuccess | UnifyError;

function success(s: Substitution): UnifyResult {
  return {
    tag: "unify-success",
    substitution: s
  };
}

function occurCheck(v: T.TVar, rootT: T.Type): UnifyOccurCheckError | null {
  function check(t: T.Type): UnifyOccurCheckError | null {
    if (t.node.tag === "type-variable" && t.node.name === v.node.name) {
      const err: UnifyOccurCheckError = {
        tag: "unify-occur-check-error",
        variable: v,
        t: rootT
      };
      return err;
    }
    if (t.node.tag === "application") {
      const errors = t.node.args.map(a => check(a)).filter(r => r !== null);
      return errors.length > 0 ? errors[0] : null;
    }
    return null;
  }
  return check(rootT);
}

//
//
function unifyVariable(v: T.TVar, t: T.Type, ctx: Substitution): UnifyResult {
  if (v.node.name in ctx) {
    return unify(ctx[v.node.name], t, ctx);
  }
  if (t.node.tag === "type-variable") {
    if (v.node.name === t.node.name) {
      return success(ctx);
    } else if (t.node.name in ctx) {
      return unifyVariable(v, ctx[t.node.name], ctx);
    } else {
      return success({ ...ctx, [v.node.name]: t });
    }
  } else {
    const err = occurCheck(v, t);
    if (err) {
      return err;
    } else {
      return success({ ...ctx, [v.node.name]: t });
    }
  }
}

function unifyArray(
  t1s: T.Type[],
  t2s: T.Type[],
  ctx: Substitution
): UnifyResult {
  if (t1s.length === 0 && t2s.length === 0) {
    return success(ctx);
  } else if (t1s.length === 0) {
    return {
      tag: "unify-missing-value-error",
      t: t2s[0]
    };
  } else if (t2s.length === 0) {
    return {
      tag: "unify-missing-value-error",
      t: t1s[0]
    };
  } else {
    const [t1, ...rest1] = t1s;
    const [t2, ...rest2] = t2s;
    const result = unify(t1, t2, ctx);
    if (result.tag === "unify-success") {
      return unifyArray(rest1, rest2, result.substitution);
    } else {
      return result;
    }
  }
}

/** Rewrite `row` to be a row staring with `label`.
 *
 * @returns an extension row, together with a subsitution that will
 * partially unify it with `row` (only the head of the extension).
 */
function rewriteRowForLabel(
  row: T.Type,
  label: string,
  tail: T.TVar | undefined,
  ctx: Substitution
): { row: T.RExtension; substitution: Substitution } | null {
  if (row.node.tag === "type-variable") {
    // RULE (row-var)
    //
    // If `row` is a variable. We create a fresh row extension
    //
    //    {label: γ | β}
    //
    // and map that variable to the row in the substitution.

    if (tail && row.node.name === tail.node.name) {
      return null;
    }

    const gamma = generateUniqueTVar();
    const beta = generateUniqueTVar();
    const theta = T.tRowExtension(label, gamma, beta);
    return {
      row: theta,
      substitution: { ...ctx, [row.node.name]: theta }
    };
  } else if (row.node.tag === "row-extension") {
    // RULE (row-head)
    //
    // If the `row` is already a row extension starting with the same
    // label, we are done.
    //
    if (row.node.label === label) {
      return {
        row: { node: row.node },
        substitution: ctx
      };
    } else {
      // RULE (row-swap)
      //
      // Firstly, we recursively rewrite the tail of the row extension
      // to start with `label.`
      const result = rewriteRowForLabel(row.node.extends, label, tail, ctx);
      if (!result) {
        return null;
      }
      const { row: newRow, substitution: subs } = result;
      //
      // The resulting row, starts with the intended label, and
      // continues with the original label that we found.
      return {
        row: T.tRowExtension(
          label,
          newRow.node.labelType,
          T.tRowExtension(
            row.node.label,
            row.node.labelType,
            newRow.node.extends
          )
        ),
        substitution: subs
      };
    }
  } else if (row.node.tag === "empty-row") {
    return null;
  } else {
    throw new Error("Should not get here");
  }
}

function unifyRow(
  row1: T.RExtension,
  row2: T.RExtension,
  ctx: Substitution
): UnifyResult {
  const tail = row1.node.extends;
  const rewriteResult = rewriteRowForLabel(
    row2,
    row1.node.label,
    isTVar(tail) ? tail : undefined,
    ctx
  );
  if (!rewriteResult) {
    return {
      tag: "unify-mismatch-error",
      t1: row1,
      t2: row2
    };
  }

  const { substitution: subs, row: row3 } = rewriteResult;
  return unifyArray(
    [row1.node.labelType, row1.node.extends],
    [row3.node.labelType, row3.node.extends],
    subs
  );
}

/** Compute the the most general unifier that unifies t1 and t2.
 *
 * @description The resulting subsitution, applied with
 * `applySubstitution` to t1 and t2 will make them equal. It is also
 * the most general one, in the sense that any other substitution can
 * be obtained as a composition of this one with another one.
 */
export function unify(t1: T.Type, t2: T.Type, ctx: Substitution): UnifyResult {
  // RULE (uni-const)
  if (t1.node.tag === "constant" && t2.node.tag === "constant") {
    return t1.node.name === t2.node.name
      ? success(ctx)
      : {
          tag: "unify-mismatch-error",
          t1,
          t2
        };
  } else if (
    t1.node.tag === "type-variable" &&
    t1.node.userSpecified &&
    t2.node.tag === "type-variable" &&
    t2.node.userSpecified
  ) {
    return t1 === t2
      ? success(ctx)
      : {
          tag: "unify-mismatch-error",
          t1,
          t2
        };
  } else if (t1.node.tag === "application" && t2.node.tag === "application") {
    // RULE: (uni-app)
    return unifyArray(
      [t1.node.op, ...t1.node.args],
      [t2.node.op, ...t2.node.args],
      ctx
    );
  } else if (t1.node.tag === "type-variable" && !t1.node.userSpecified) {
    // RULE: (uni-varl)
    return unifyVariable({ node: t1.node }, { node: t2.node }, ctx);
  } else if (t2.node.tag === "type-variable" && !t2.node.userSpecified) {
    // RULE: (uni-varr)
    return unifyVariable({ node: t2.node }, { node: t1.node }, ctx);
  } else if (t1.node.tag === "empty-row" && t2.node.tag === "empty-row") {
    // RULE (uni-const)
    return success(ctx);
  } else if (
    t1.node.tag === "row-extension" &&
    t2.node.tag === "row-extension"
  ) {
    // RULE: (uni-row)
    return unifyRow({ node: t1.node }, { node: t2.node }, ctx);
  } else {
    return {
      tag: "unify-mismatch-error",
      t1,
      t2
    };
  }
}

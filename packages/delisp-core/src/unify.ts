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
import { Substitution } from "./type-utils";
import { TypeF, RExtension, tRowExtension, TVar } from "./types";

interface UnifySuccess {
  tag: "unify-success";
  substitution: Substitution;
}

interface UnifyOccurCheckError {
  tag: "unify-occur-check-error";
  variable: TVar;
  t: TypeF;
}

interface UnifyMismatchError {
  tag: "unify-mismatch-error";
  t1: TypeF;
  t2: TypeF;
}

interface UnifyMissingValueError {
  tag: "unify-missing-value-error";
  t: TypeF;
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

function occurCheck(v: TVar, rootT: TypeF): UnifyOccurCheckError | null {
  function check(t: TypeF): UnifyOccurCheckError | null {
    if (t.tag === "type-variable" && t.name === v.name) {
      const err: UnifyOccurCheckError = {
        tag: "unify-occur-check-error",
        variable: v,
        t: rootT
      };
      return err;
    }
    if (t.tag === "application") {
      const errors = t.args.map(a => check(a.node)).filter(r => r !== null);
      return errors.length > 0 ? errors[0] : null;
    }
    return null;
  }
  return check(rootT);
}

//
//
function unifyVariable(v: TVar, t: TypeF, ctx: Substitution): UnifyResult {
  if (v.name in ctx) {
    return unify(ctx[v.name], t, ctx);
  }
  if (t.tag === "type-variable") {
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
  t1s: TypeF[],
  t2s: TypeF[],
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
  row: TypeF,
  label: string,
  ctx: Substitution
): { row: RExtension; substitution: Substitution } {
  if (row.tag === "type-variable") {
    // RULE (row-var)
    //
    // If `row` is a variable. We create a fresh row extension
    //
    //    {label: γ | β}
    //
    // and map that variable to the row in the substitution.
    const gamma = generateUniqueTVar();
    const beta = generateUniqueTVar();
    const theta = tRowExtension(label, gamma, beta);
    return {
      row: theta,
      substitution: { ...ctx, [row.name]: theta }
    };
  } else if (row.tag === "row-extension") {
    // RULE (row-head)
    //
    // If the `row` is already a row extension starting with the same
    // label, we are done.
    //
    if (row.label === label) {
      return {
        row,
        substitution: ctx
      };
    } else {
      // RULE (row-swap)
      //
      // Firstly, we recursively rewrite the tail of the row extension
      // to start with `label.`
      const { row: newRow, substitution: subs } = rewriteRowForLabel(
        row.extends.node,
        label,
        ctx
      );
      //
      // The resulting row, starts with the intended label, and
      // continues with the original label that we found.
      return {
        row: tRowExtension(
          label,
          newRow.labelType.node,
          tRowExtension(row.label, row.labelType.node, newRow.extends.node)
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
  const { substitution: subs, row: row3 } = rewriteRowForLabel(
    row2,
    row1.label,
    ctx
  );

  if (
    row1.extends.node.tag === "type-variable" &&
    subs[row1.extends.node.name]
  ) {
    return {
      tag: "unify-mismatch-error",
      t1: row1,
      t2: row2
    };
  }

  return unifyArray(
    [row1.labelType.node, row1.extends.node],
    [row3.labelType.node, row3.extends.node],
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
export function unify(t1: TypeF, t2: TypeF, ctx: Substitution): UnifyResult {
  // RULE (uni-const)
  if (t1.tag === "constant" && t2.tag === "constant") {
    return t1.name === t2.name
      ? success(ctx)
      : {
          tag: "unify-mismatch-error",
          t1,
          t2
        };
  } else if (
    t1.tag === "type-variable" &&
    t1.userSpecified &&
    t2.tag === "type-variable" &&
    t2.userSpecified
  ) {
    return t1 === t2
      ? success(ctx)
      : {
          tag: "unify-mismatch-error",
          t1,
          t2
        };
  } else if (t1.tag === "application" && t2.tag === "application") {
    // RULE: (uni-app)
    return unifyArray(
      [t1.op.node, ...t1.args.map(a => a.node)],
      [t2.op.node, ...t2.args.map(a => a.node)],
      ctx
    );
  } else if (t1.tag === "type-variable" && !t1.userSpecified) {
    // RULE: (uni-varl)
    return unifyVariable(t1, t2, ctx);
  } else if (t2.tag === "type-variable" && !t2.userSpecified) {
    // RULE: (uni-varr)
    return unifyVariable(t2, t1, ctx);
  } else if (t1.tag === "empty-row" && t2.tag === "empty-row") {
    // RULE (uni-const)
    return success(ctx);
  } else if (t1.tag === "row-extension" && t2.tag === "row-extension") {
    // RULE: (uni-row)
    return unifyRow(t1, t2, ctx);
  } else {
    return {
      tag: "unify-mismatch-error",
      t1,
      t2
    };
  }
}

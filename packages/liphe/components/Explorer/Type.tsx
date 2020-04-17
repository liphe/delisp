import * as Delisp from "@delisp/core";
import * as React from "react";
import { createContext, useContext } from "react";

import { useTypeNormalizer } from "./common";
import styles from "./Type.module.css";

export interface TypeContext {
  containerType?: Delisp.Type;
}

export const TypeContext = createContext<TypeContext>({});

interface TypeExplorerProps {
  type: Delisp.Type;
  container?: Delisp.Type;
}

export const TypeExplorer: React.FC<TypeExplorerProps> = ({ type }) => {
  if (Delisp.isTVar(type)) {
    return <TypeVariableExplorer tvar={type} />;
  } else if (Delisp.isTConstant(type)) {
    return <TypeConstantExplorer type={type} />;
  } else if (Delisp.isFunctionType(type)) {
    return <TypeFunctionExplorer tFn={type} />;
  } else {
    const normalizer = useTypeNormalizer();
    return (
      <span className="type">
        {Delisp.printTypeWithNormalizer(type, normalizer)}
      </span>
    );
  }
};

export const TypeVariableExplorer: React.FC<{ tvar: Delisp.T.Var }> = ({
  tvar,
}) => {
  const normalizer = useTypeNormalizer();
  return <span>{normalizer(tvar)}</span>;
};

export const TypeConstantExplorer: React.FC<{ type: Delisp.T.Constant }> = ({
  type,
}) => {
  return <span className={styles.typeConstant}>{type.node.name}</span>;
};

const SExpr: React.FC<{ left: string; right: string }> = ({
  left,
  children,
  right,
}) => {
  return (
    <>
      <span className={styles.delimiter}>{left}</span>
      {children}
      <span className={styles.delimiter}>{right}</span>
    </>
  );
};

export const TypeFunctionExplorer: React.FC<{ tFn: Delisp.T.Application }> = ({
  tFn,
}) => {
  const { containerType } = useContext(TypeContext);

  const parts = analyzeFunctionType(tFn, containerType);

  return (
    <SExpr left="(" right=")">
      <span className={styles.typeFunction}>
        <span>&rarr;</span>
        {parts.context && (
          <>
            <span className={styles.keyword}>:context</span>
            <TypeExplorer type={parts.context} />
          </>
        )}
        {parts.args && (
          <>
            <span className={styles.keyword}>:from</span>
            <SExpr left="[" right="]">
              {parts.args.map((t, i) => (
                <TypeExplorer key={i} type={t} />
              ))}
            </SExpr>
          </>
        )}
        {parts.effects && (
          <>
            <span className={styles.keyword}>:effect</span>
            <SExpr left="[" right="]">
              {parts.effects.labels.map((label, i) => (
                <span key={i}>{label}</span>
              ))}
              {parts.effects.extends && (
                <>
                  {" "}
                  &hellip;
                  <TypeExplorer type={parts.effects.extends} />
                </>
              )}
            </SExpr>
          </>
        )}

        {parts.outputs && (
          <>
            <span className={styles.keyword}>:to</span>
            <SExpr left="[" right="]">
              {parts.outputs.types.map((t, i) => (
                <TypeExplorer key={i} type={t} />
              ))}
              {parts.outputs.extends && (
                <>
                  &hellip;
                  {parts.outputs.extends.type && (
                    <TypeExplorer type={parts.outputs.extends.type} />
                  )}
                </>
              )}
            </SExpr>
          </>
        )}
      </span>
    </SExpr>
  );
};

/// Analyze a function type in preparation for visualization.
///
/// This function will normalize some fields an check wether different
/// parts of the type are uncosntrainted and can be ellided.
///
/// In order to encourage correct visualizations and consistent
/// elliding rules, this function wont' return values that the view
/// should not show.
export function analyzeFunctionType(
  tFn: Delisp.T.Application,
  container?: Delisp.Type
) {
  const {
    args: [context, ...args],
    effect,
    output,
  } = Delisp.decomposeFunctionType(tFn);

  // Context
  const isContextUnconstrainted =
    container && Delisp.isUnconstraint(context, container);

  // Effects
  const effects = Delisp.normalizeEffect(effect);
  const isEffectUnconstrainted =
    container && Delisp.isUnconstraint(effects.extends, container);

  // Output
  const outputs = Delisp.normalizeOutput(output);
  const isOutputOpen = Delisp.isTVar(outputs.extends);
  const isOutputUnconstrainted =
    container && Delisp.isUnconstraint(outputs.extends, container);

  return {
    context: isContextUnconstrainted ? null : context,

    args: args.length === 0 ? null : args,

    effects:
      effects.fields.length === 0 && isEffectUnconstrainted
        ? null
        : {
            labels: effects.fields.map((f) => f.label),
            extends: isEffectUnconstrainted ? null : effects.extends,
          },

    outputs:
      outputs.fields.length === 0 && !isOutputOpen
        ? null
        : {
            show: true,
            types: outputs.fields.map((out) => out.labelType),
            extends: isOutputOpen
              ? {
                  type: isOutputUnconstrainted ? null : outputs.extends,
                }
              : null,
          },
  };
}

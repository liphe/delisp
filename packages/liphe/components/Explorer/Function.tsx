import * as Delisp from "@delisp/core";
import { Typed } from "@delisp/core";
import * as React from "react";

import { Cursor, useTypeNormalizer } from "./common";
import { ExpressionExplorer } from "./Expression";
import styles from "./Function.module.css";
import { IdentifierExplorer } from "./Identifier";
import { TypeExplorer } from "./Type";

export const EffectTypeExplorer: React.FC<{
  effectType: Delisp.Type;
  functionType: Delisp.Type;
}> = ({ effectType, functionType }) => {
  const effects = Delisp.normalizeEffect(effectType);
  const unconstraintedEffect = Delisp.isUnconstraint(
    effects.extends,
    functionType
  );

  if (effects.fields.length === 0 && unconstraintedEffect) {
    return <p>None</p>;
  }

  return (
    <ul>
      {effects.fields.map((eff, effPosition) => {
        return (
          <li className={styles.effect} key={effPosition}>
            <span className={styles.typeVariable}>{eff.label}</span>
          </li>
        );
      })}
      {Delisp.isUnconstraint(effects.extends, functionType) ? null : (
        <li className={styles.effect}>
          ... <TypeExplorer type={effects.extends} />
        </li>
      )}
    </ul>
  );
};

export const ValuesTypeExplorer: React.FC<{
  type: Delisp.Type;
}> = ({ type }) => {
  const row = Delisp.normalizeOutput(type);
  return (
    <ul>
      {row.fields.map((value, valuePosition) => {
        return (
          <li key={valuePosition}>
            <TypeExplorer type={value.labelType}></TypeExplorer>
          </li>
        );
      })}
      {Delisp.isEmtpyRow(row.extends) ? null : (
        <li>
          ... <TypeExplorer type={row.extends} />
        </li>
      )}
    </ul>
  );
};

export const FunctionInfoSection: React.FC<{ label: string }> = ({
  label,
  children,
}) => {
  return (
    <div className={styles.functionSection}>
      <strong>{label}</strong>
      <div className={styles.functionSectionContent}>{children}</div>
    </div>
  );
};

export const DetailedFunctionExplorer: React.FC<{
  cursor: Cursor<Delisp.SFunction<Typed>>;
}> = ({ cursor }) => {
  const fn = cursor.value;
  const selfType = fn.info.selfType;
  if (!Delisp.isFunctionType(selfType)) {
    throw new Error("The type of a function is not a function type??");
  }
  const type = Delisp.decomposeFunctionType(selfType);

  const [, ...args] = fn.node.lambdaList.positionalArguments;
  const [contextType, ...argsTypes] = type.args;

  const bodyCursor = cursor.prop("node").prop("body");
  const argsCursor = Cursor.slice(
    cursor.prop("node").prop("lambdaList").prop("positionalArguments"),
    1
  );

  return (
    <div className={styles.function}>
      {Delisp.isUnconstraint(contextType, selfType) ? null : (
        <FunctionInfoSection label="*context*">
          <TypeExplorer type={contextType} />
        </FunctionInfoSection>
      )}

      <FunctionInfoSection label="Arguments:">
        {args.length === 0 ? (
          "None"
        ) : (
          <ul className={styles.functionArguments}>
            {Cursor.map(argsCursor, (arg, argPosition) => {
              return (
                <li key={arg.value.name}>
                  <IdentifierExplorer cursor={arg} /> -{" "}
                  <TypeExplorer type={argsTypes[argPosition]} />
                </li>
              );
            })}
          </ul>
        )}
      </FunctionInfoSection>

      <FunctionInfoSection label="Output:">
        <ValuesTypeExplorer type={type.output} />
      </FunctionInfoSection>

      <FunctionInfoSection label="Effect:">
        <EffectTypeExplorer effectType={type.effect} functionType={selfType} />
      </FunctionInfoSection>

      <FunctionInfoSection label="Implementation:">
        {Cursor.map(bodyCursor, (c, i) => {
          return (
            <div key={i}>
              <ExpressionExplorer cursor={c} />
            </div>
          );
        })}
      </FunctionInfoSection>
    </div>
  );
};

const typeToString = (type: Delisp.Type) => {
  const normalizer = useTypeNormalizer();
  return Delisp.printTypeWithNormalizer(type, normalizer);
};

export const FunctionExplorer: React.FC<{
  cursor: Cursor<Delisp.SFunction<Typed>>;
}> = ({ cursor }) => {
  const fn = cursor.value;
  const bodyCursor = cursor.prop("node").prop("body");
  const argsCursor = Cursor.slice(
    cursor.prop("node").prop("lambdaList").prop("positionalArguments"),
    1
  );
  return (
    <div>
      <span title={typeToString(fn.info.selfType)}>
        <strong>λ</strong>
      </span>{" "}
      {Cursor.map(argsCursor, (c, i) => (
        <React.Fragment key={i}>
          <IdentifierExplorer cursor={c} />{" "}
        </React.Fragment>
      ))}
      →{" "}
      {Cursor.map(bodyCursor, (c, i) => {
        return (
          <div key={i}>
            <ExpressionExplorer cursor={c} />
          </div>
        );
      })}
    </div>
  );
};

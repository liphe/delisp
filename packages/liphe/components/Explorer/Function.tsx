import * as Delisp from "@delisp/core";
import { Typed } from "@delisp/core";
import * as React from "react";

import { useTypeNormalizer } from "./common";
import { ExpressionExplorer } from "./Expression";
import styles from "./Function.module.css";
import { IdentifierExplorer } from "./Identifier";
import { analyzeFunctionType, TypeExplorer } from "./Type";
import { Cursor } from "./utils/Cursor";

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

  const typeParts = analyzeFunctionType(selfType, selfType);

  const bodyCursor = cursor.prop("node").prop("body");
  const argsCursor = Cursor.slice(
    cursor.prop("node").prop("lambdaList").prop("positionalArguments"),
    1
  );

  return (
    <div className={styles.function}>
      {typeParts.context && (
        <FunctionInfoSection label="*context*">
          <TypeExplorer type={typeParts.context} />
        </FunctionInfoSection>
      )}

      <FunctionInfoSection label="Arguments:">
        {!typeParts.args ? (
          "None"
        ) : (
          <ul className={styles.functionArguments}>
            {Cursor.map(argsCursor, (arg, argPosition) => {
              return (
                <li key={arg.value.name}>
                  <IdentifierExplorer cursor={arg} /> -{" "}
                  <TypeExplorer type={typeParts.args![argPosition]} />
                </li>
              );
            })}
          </ul>
        )}
      </FunctionInfoSection>

      <FunctionInfoSection label="Output:">
        {!typeParts.outputs ? (
          "None"
        ) : (
          <ul>
            {typeParts.outputs.types.map((t, i) => (
              <li key={i}>
                <TypeExplorer type={t} />
              </li>
            ))}
            {typeParts.outputs.extends && (
              <li>
                &hellip;
                {typeParts.outputs.extends.type && (
                  <TypeExplorer type={typeParts.outputs.extends.type} />
                )}
              </li>
            )}
          </ul>
        )}
      </FunctionInfoSection>

      <FunctionInfoSection label="Effect:">
        {!typeParts.effects ? (
          "None"
        ) : (
          <ul>
            {typeParts.effects.labels.map((label, i) => {
              <li key={i}>
                <span>{label}</span>
              </li>;
            })}
            {typeParts.effects.extends && (
              <li>
                &hellip;
                {typeParts.effects.extends && (
                  <TypeExplorer type={typeParts.effects.extends} />
                )}
              </li>
            )}
          </ul>
        )}
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

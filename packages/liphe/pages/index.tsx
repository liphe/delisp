import * as React from "react";
import * as Delisp from "@delisp/core";
import { PageLayout } from "../components/PageLayout";

import styles from "./index.module.css";

export const ModuleExplorer: React.FC<{ module: Delisp.Module }> = ({
  module,
}) => {
  return (
    <div className={styles.module}>
      {module.body.map((syntax, i) => (
        <SyntaxExplorer key={i} syntax={syntax} />
      ))}
    </div>
  );
};

export const SyntaxExplorer: React.FC<{ syntax: Delisp.Syntax }> = ({
  syntax,
}) => {
  if (Delisp.isExpression(syntax)) {
    return <ExpressionExplorer expression={syntax} />;
  } else {
    return null;
  }
};

export const ExpressionExplorer: React.FC<{
  expression: Delisp.Expression;
}> = ({ expression }) => {
  switch (expression.node.tag) {
    case "number":
      return (
        <NumberExplorer value={{ ...expression, node: expression.node }} />
      );
    case "string":
      return (
        <StringExplorer value={{ ...expression, node: expression.node }} />
      );
    case "none":
      return <NoneExplorer value={{ ...expression, node: expression.node }} />;
    case "boolean":
      return (
        <BooleanExplorer value={{ ...expression, node: expression.node }} />
      );

    case "record":
      return (
        <RecordExplorer record={{ ...expression, node: expression.node }} />
      );
    default:
      return null;
  }
};

export const NumberExplorer: React.FC<{ value: Delisp.SNumber }> = ({
  value,
}) => {
  const n = value.node.value;
  return (
    <span title={`{n} = 0x${n.toString(16)} = b${n.toString(2)}`}>{n}</span>
  );
};

export const StringExplorer: React.FC<{ value: Delisp.SString }> = ({
  value,
}) => {
  return <span>&quot;{value.node.value}&quot;</span>;
};

export const BooleanExplorer: React.FC<{ value: Delisp.SBoolean }> = ({
  value,
}) => {
  return <span>{value.node.value}</span>;
};

export const NoneExplorer: React.FC<{ value: Delisp.SNone }> = () => {
  return <span>none</span>;
};

export const RecordExplorer: React.FC<{
  record: Delisp.SRecord;
}> = ({ record }) => {
  return (
    <div className={styles.record}>
      {"{"}
      <ul>
        {record.node.fields.map((field) => {
          return (
            <li key={field.label.name}>
              <IdentifierExplorer identifier={field.label} />{" "}
              <ExpressionExplorer expression={field.value} />
            </li>
          );
        })}
      </ul>
      {"}"}
    </div>
  );
};

export const IdentifierExplorer: React.FC<{
  identifier: Delisp.Identifier;
}> = ({ identifier }) => {
  return (
    <code>
      <span className={styles.identifier}>{identifier.name}</span>
    </code>
  );
};

export default function Homepage() {
  const module = Delisp.readModule(`
{:x 10 :y 20 :z {:name "david"}}
`);
  return (
    <div>
      <PageLayout>
        <div>test</div>
        <ModuleExplorer module={module} />
      </PageLayout>
    </div>
  );
}

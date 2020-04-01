import * as React from "react";
import * as Delisp from "@delisp/core";
import { PageLayout } from "../components/PageLayout";

export const ModuleExplorer: React.FC<{ module: Delisp.Module }> = ({
  module,
}) => {
  return (
    <div>
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
  expression: Delisp.Syntax;
}> = () => {
  return <>expression</>;
};

export const RecordExplorer: React.FC<{
  record: Delisp.SRecord;
}> = ({ record }) => {
  return <div>{record}</div>;
};

export default function Homepage() {
  const module = Delisp.readModule(`
{:x 10 :y 20}
`);
  return (
    <PageLayout>
      <ModuleExplorer module={module} />
    </PageLayout>
  );
}

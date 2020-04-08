import * as Delisp from "@delisp/core";
import { Typed } from "@delisp/core";
import * as React from "react";
import { DetailedFunctionExplorer } from "./Function";
import { ExpressionExplorer } from "./Expression";
import { TypeExplorer } from "./Type";
import styles from "./Definition.module.css";

const DefinitionValueExplorer: React.FC<{
  value: Delisp.Expression<Typed>;
}> = ({ value }) => {
  if (value.node.tag === "function") {
    return <DetailedFunctionExplorer fn={{ ...value, node: value.node }} />;
  } else {
    return <ExpressionExplorer expression={value} />;
  }
};

const DefinitionValueKindExplorer: React.FC<{
  value: Delisp.Expression<Typed>;
}> = ({ value }) => {
  if (value.node.tag === "function") {
    return <span>λ</span>;
  } else {
    return <TypeExplorer type={value.info.selfType} />;
  }
};

export const DefinitionExplorer: React.FC<{
  definition: Delisp.SDefinition<Typed>;
}> = ({ definition }) => {
  return (
    <div className={styles.definition}>
      <span className={styles.definitionLabel}>
        {definition.node.variable.name}
      </span>
      <span className={styles.definitionType}>
        <DefinitionValueKindExplorer value={definition.node.value} />
      </span>
      <DefinitionValueExplorer value={definition.node.value} />
    </div>
  );
};

import * as Delisp from "@delisp/core";
import * as React from "react";

import { useTypeNormalizer } from "./common";

export const TypeExplorer: React.FC<{ type: Delisp.Type }> = ({ type }) => {
  if (Delisp.isTVar(type)) {
    return <TypeVariableExplorer tvar={type} />;
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

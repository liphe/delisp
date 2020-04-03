import * as React from "react";
import { useState } from "react";

import * as Delisp from "@delisp/core";
import { Typed } from "@delisp/core";
import { GenericSyntaxExplorer } from "../PPrinter";

import { Context } from "./common";
import { SyntaxExplorer } from "./Syntax";

export const ModuleExplorer: React.FC<{ module: Delisp.Module<Typed> }> = ({
  module,
}) => {
  return (
    <div>
      {module.body.map((syntax, i) => (
        <ToplevelSyntaxExplorer key={i} syntax={syntax} />
      ))}
    </div>
  );
};

export const ToplevelSyntaxExplorer: React.FC<{
  syntax: Delisp.Syntax<Typed>;
}> = ({ syntax }) => {
  const [raw, setRaw] = useState(false);
  const normalizer = Delisp.createVariableNormalizer();

  const content = (() => {
    if (raw) {
      return <GenericSyntaxExplorer syntax={syntax} normalizer={normalizer} />;
    } else {
      return <SyntaxExplorer syntax={syntax} />;
    }
  })();

  return (
    <Context.Provider value={normalizer}>
      <div>
        <button
          onClick={() => {
            setRaw(!raw);
          }}
        >
          {raw ? "Rich" : "Text"}
        </button>
        {content}
      </div>
    </Context.Provider>
  );
};

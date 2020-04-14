import * as Delisp from "@delisp/core";
import { Typed } from "@delisp/core";
import * as React from "react";
import { useState } from "react";

import { GenericSyntaxExplorer } from "../PPrinter";
import { Context, Cursor } from "./common";
import { SyntaxExplorer } from "./Syntax";

export const ModuleExplorer: React.FC<{
  cursor: Cursor<Delisp.Module<Typed>>;
}> = ({ cursor }) => {
  return (
    <div>
      {Cursor.map(cursor.prop("body"), (c, i) => (
        <ToplevelSyntaxExplorer key={i} cursor={c} />
      ))}
    </div>
  );
};

export const ToplevelSyntaxExplorer: React.FC<{
  cursor: Cursor<Delisp.Syntax<Typed>>;
}> = ({ cursor }) => {
  const [raw, setRaw] = useState(false);
  const normalizer = Delisp.createVariableNormalizer();

  const content = (() => {
    if (raw) {
      return (
        <GenericSyntaxExplorer syntax={cursor.value} normalizer={normalizer} />
      );
    } else {
      return <SyntaxExplorer cursor={cursor} />;
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

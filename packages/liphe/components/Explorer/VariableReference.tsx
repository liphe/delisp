import * as Delisp from "@delisp/core";
import * as React from "react";
import { useState } from "react";

import { Extended } from "./common";
import { useTypeNormalizer } from "./common";
import { Cursor } from "./utils/Cursor";

interface InputProps {
  cursor: Cursor<Delisp.SVariableReference<Extended>>;
  onDone(): void;
}

const Input: React.FC<InputProps> = ({ cursor, onDone }) => {
  const availableVars = cursor.value.info.variables;
  return (
    <div>
      <ul>
        {availableVars?.map((v) => (
          <li
            key={v}
            onClick={() => {
              const expr = Delisp.readSyntax(v) as Delisp.SVariableReference;
              cursor.update(expr);
              onDone();
            }}
          >
            {v}
          </li>
        ))}
      </ul>
    </div>
  );
};

export const VariableReferenceExplorer: React.FC<{
  cursor: Cursor<Delisp.SVariableReference<Extended>>;
}> = ({ cursor }) => {
  const variable = cursor.value;
  const normalizer = useTypeNormalizer();
  const varType =
    variable.info.selfType &&
    Delisp.printTypeWithNormalizer(variable.info.selfType, normalizer);

  const [editMode, setEditMode] = useState(false);

  const isPlaceholder = variable.node.name.startsWith("__");

  return (
    <span
      style={{ color: "#00aa00" }}
      title={varType}
      onDoubleClick={() => {
        setEditMode(true);
      }}
    >
      {editMode ? (
        <Input cursor={cursor} onDone={() => setEditMode(false)} />
      ) : isPlaceholder ? (
        "??????"
      ) : (
        variable.node.name
      )}
    </span>
  );
};

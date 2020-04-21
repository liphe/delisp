import * as Delisp from "@delisp/core";
import { Typed } from "@delisp/core";
import * as React from "react";

import { Indent, Keyword, SExprList } from "./common";
import { ExpressionExplorer } from "./Expression";
import { Cursor } from "./utils/Cursor";

interface BindingProps {
  variable: Cursor<Delisp.Identifier>;
  value: Cursor<Delisp.Expression<Typed>>;
  onDelete: () => void;
}

const Binding: React.FC<BindingProps> = ({ variable, value, onDelete }) => {
  return (
    <div>
      {variable.value.name} = <ExpressionExplorer cursor={value} />{" "}
      <button onClick={() => onDelete()}>x</button>
    </div>
  );
};

export const LetExplorer: React.FC<{
  cursor: Cursor<Delisp.SLet<Typed>>;
}> = ({ cursor }) => {
  const bindings = cursor.prop("node").prop("bindings");
  const bodyCursor = cursor.prop("node").prop("body");

  const deleteBinding = (variable: string) => {
    bindings.update(
      bindings.value.filter((bind) => {
        return bind.variable.name !== variable;
      })
    );
  };

  return (
    <SExprList>
      <Keyword name="let" />

      {Cursor.map(bindings, (bind, i) => (
        <Binding
          key={i}
          variable={bind.prop("variable")}
          value={bind.prop("value")}
          onDelete={() => {
            deleteBinding(bind.value.variable.name);
          }}
        />
      ))}

      <Indent>
        {Cursor.map(bodyCursor, (c, i) => {
          return (
            <div key={i}>
              <ExpressionExplorer cursor={c} />
            </div>
          );
        })}
      </Indent>
    </SExprList>
  );
};

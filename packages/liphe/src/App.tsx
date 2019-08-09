/* eslint-disable react/jsx-key */

import React from "react";
import styled from "styled-components";

import { updateCode, Action, State } from "./state";

import {
  Module,
  Syntax,
  isExpression,
  readModule,
  compileModuleToString,
  inferModule,
  pprintAs,
  printType,
  Encoder,
  Typed
} from "@delisp/core";

const LINE_WIDTH = 40;

type ASTResult =
  | { tag: "success"; module: Module<Typed> }
  | { tag: "error"; message: string };

export function assertNever(x: never): never {
  throw new Error("Unexpected object: " + x);
}

function readModuleOrError(code: string): ASTResult {
  try {
    const m = readModule(code);
    const inferredM = inferModule(m);
    return { tag: "success", module: inferredM.typedModule };
  } catch (err) {
    return { tag: "error", message: err.message };
  }
}

const Panel = styled.div`
  display: inline-block;
  width: 50%;
  vertical-align: top;
`;

function AST(props: { code: string }) {
  const { code } = props;
  const result = readModuleOrError(code);

  switch (result.tag) {
    case "success": {
      const js = compileModuleToString(result.module, {
        getOutputFile: file => file
      });

      return (
        <div>
          <Panel>
            <ModuleExplorer module={result.module} />
          </Panel>
          <Panel>
            <pre>{js}</pre>
          </Panel>
        </div>
      );
    }
    case "error":
      return (
        <div>
          <span>Something went wrong</span>
          <pre>{result.message}</pre>
        </div>
      );
  }
}

function ModuleExplorer({ module: m }: { module: Module<Typed> }) {
  return (
    <div>
      {m.body.map((s, i) => (
        <SyntaxExplorer key={i} syntax={s} />
      ))}
    </div>
  );
}

function SyntaxExplorer({ syntax }: { syntax: Syntax<Typed> }) {
  return <GenericSyntaxExplorer syntax={syntax} />;
}

const Editor = styled.textarea`
  width: 100%;
  height: 200px;
  font-family: courier;
  font-size: 1.5em;
`;

const Code = styled.pre`
  background-color: white;
  padding: 5px;
  font-family: courier;

  .delimiter {
    color: #bbb;
  }

  .variable-definition {
    color: #c42;
  }

  .keyword {
    color: blue;
  }

  .number {
    color: orange;
  }

  .string {
    color: red;
  }
`;

const Token = styled.span`
  &:hover {
    background-color: #88f;
  }
`;

const PrettierEncoder: Encoder<React.ReactElement[]> = {
  fromString: function PrettierEncoder(
    x: string,
    kind: string[],
    source?: Syntax<Typed>
  ) {
    return [
      <Token
        data-source={source}
        className={kind.join(" ")}
        onClick={() => {
          console.log({ source });
        }}
        title={
          source && isExpression(source)
            ? printType(source.info.selfType)
            : undefined
        }
      >
        {x}
      </Token>
    ];
  },
  concat: (...args: React.ReactElement[][]): React.ReactElement[] =>
    args.flat(1)
};

function GenericSyntaxExplorer({ syntax }: { syntax: Syntax }) {
  return <Code>{pprintAs(syntax, LINE_WIDTH, PrettierEncoder)}</Code>;
}

export function App({
  state,
  dispatch
}: {
  state: State;
  dispatch: React.Dispatch<Action>;
}) {
  return (
    <div>
      <h1>Liphe</h1>
      <Editor
        value={state.code}
        onChange={e => dispatch(updateCode(e.target.value))}
      />
      <AST code={state.code} />
    </div>
  );
}

/* eslint-enable react/jsx-key */

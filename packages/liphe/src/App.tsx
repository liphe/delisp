import React from "react";
import styled from "styled-components";

import { updateCode, Action, State } from "./state";

import {
  Module,
  Syntax,
  isExpression,
  readModule,
  inferModule,
  pprintAs,
  printType,
  Type,
  Encoder,
  exprFChildren,
  SDefinition,
  isDefinition,
  isTypeAlias,
  isExport,
  // SExport,
  // STypeAlias,
  Expression,
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

function AST(props: { code: string }) {
  const { code } = props;
  const result = readModuleOrError(code);
  switch (result.tag) {
    case "success":
      return <ModuleExplorer module={result.module} />;
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
  if (isExpression(syntax)) {
    return <ExpressionExplorer expr={syntax} />;
  } else if (isDefinition(syntax)) {
    return <DefinitionExplorer definition={syntax} />;
  } else if (isExport(syntax)) {
    return <GenericSyntaxExplorer syntax={syntax} />;
  } else if (isTypeAlias(syntax)) {
    return <GenericSyntaxExplorer syntax={syntax} />;
  } else {
    throw new Error(`??? TS is not detecting exhaustiveness.`);
  }
}

function DefinitionExplorer({
  definition
}: {
  definition: SDefinition<Typed>;
}) {
  return (
    <div>
      <span>Definition: {definition.node.variable.name}</span>
      <ExpressionExplorer expr={definition.node.value} />
    </div>
  );
}

const Editor = styled.textarea`
  width: 100%;
  height: 200px;
  font-family: courier;
  font-size: 1.5em;
`;

const Box = styled.div`
  border: 1px solid;
  margin: 10px;
  padding: 5px;
  background-color: rgba(200, 200, 255, 0.8);

  .delimiter {
    color: #bbb;
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

const Code = styled.pre`
  background-color: white;
  padding: 5px;
  font-family: courier;
`;

const Token = styled.span`
  &:hover {
    background-color: #88f;
  }
`;

const PrettierEncoder: Encoder<React.ReactElement[]> = {
  fromString: (x: string, kind: string, source?: Syntax<Typed>) => [
    <Token
      data-source={source}
      className={kind}
      onClick={() => {
        console.log({ source });
      }}
      title={
        source && isExpression(source) ? printType(source.info.type) : undefined
      }
    >
      {x}
    </Token>
  ],
  concat: (...args: React.ReactElement[][]): React.ReactElement[] =>
    args.flat(1)
};

function ExpressionExplorer({ expr }: { expr: Expression<Typed> }) {
  const subexpr = exprFChildren(expr).map((e, i) => (
    <ExpressionExplorer key={i} expr={e} />
  ));
  return (
    <Box>
      <Code>{pprintAs(expr, LINE_WIDTH, PrettierEncoder)}</Code>
      {subexpr.length === 0 ? null : (
        <details>
          <summary>Subexpressions</summary>
          {subexpr}
        </details>
      )}
      <details>
        <summary>Type</summary>
        <TypeExplorer type={expr.info.type} />
      </details>
      <details>
        <summary>Effect</summary>
        <TypeExplorer type={expr.info.effect} />
      </details>
      <details>
        <summary>Location</summary>
        <UnknownExplorer value={expr.location} />
      </details>
      <div />
    </Box>
  );
}

function TypeExplorer({ type }: { type: Type }) {
  return <Code>{printType(type, false)}</Code>;
}

function GenericSyntaxExplorer({ syntax }: { syntax: Syntax }) {
  return (
    <Box>
      <Code>{pprintAs(syntax, LINE_WIDTH, PrettierEncoder)}</Code>
    </Box>
  );
}

function UnknownExplorer({ value }: { value: unknown }) {
  return <pre>{JSON.stringify(value, null, 2)}</pre>;
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

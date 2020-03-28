/* eslint-disable react/jsx-key */

import {
  compileModuleToString,
  Encoder,
  inferModule,
  isExpression,
  Expression,
  macroexpandModule,
  Module,
  pprintAs,
  printTypeWithNormalizer,
  readModule,
  Syntax,
  SDefinition,
  Type,
  Typed,
  TypeVariableNormalizer,
  createVariableNormalizer,
} from "@delisp/core";
import React, { useState } from "react";
import styled, { css } from "styled-components";
import { Action, State, updateCode } from "./state";

const LINE_WIDTH = 40;

interface ViewProps {
  code: string;
}

interface CodeView {
  name: string;
  render: React.FunctionComponent<ViewProps>;
}

const VIEWS: CodeView[] = [
  {
    name: "Pretty Print",
    render: function PrettyPrint({ code }) {
      const m = readModule(code);
      return <ModuleExplorer module={m} />;
    },
  },
  {
    name: "Macroexpand",
    render: function MacroExpand({ code }) {
      const m = macroexpandModule(readModule(code));
      return <ModuleExplorer module={m} />;
    },
  },
  {
    name: "Type inference",
    render: function TypeInference({ code }) {
      const inferred = inferModule(macroexpandModule(readModule(code)));
      return <ModuleExplorer module={inferred.typedModule} />;
    },
  },
  {
    name: "JS",
    render: function JS({ code }) {
      const inferred = inferModule(macroexpandModule(readModule(code)));
      const js = compileModuleToString(inferred.typedModule, {
        getOutputFile: (file) => file,
      });
      return <pre>{js}</pre>;
    },
  },
];

function AST({ code }: { code: string }) {
  const [currentView, setCurrentView] = useState(VIEWS[0]);
  const Component = (props: ViewProps) => {
    try {
      return currentView.render(props);
    } catch (err) {
      return (
        <div>
          <span>Something went wrong</span>
        </div>
      );
    }
  };

  return (
    <div>
      <div>
        {VIEWS.map((v) => (
          <ViewButton
            selected={v === currentView}
            onClick={() => setCurrentView(v)}
          >
            {v.name}
          </ViewButton>
        ))}
      </div>
      <div>
        <Component code={code} />
      </div>
    </div>
  );
}

function ModuleExplorer({ module: m }: { module: Module<Typed | {}> }) {
  return (
    <div>
      {m.body.map((s, i) => (
        <SyntaxExplorer key={i} syntax={s} />
      ))}
    </div>
  );
}

function SyntaxExplorer({ syntax }: { syntax: Syntax<Typed | {}> }) {
  switch (syntax.node.tag) {
    case "definition":
      return (
        <DefinitionExplorer definition={{ ...syntax, node: syntax.node }} />
      );
    default:
      return (
        <GenericSyntaxExplorer
          syntax={syntax}
          normalizer={createVariableNormalizer()}
        />
      );
  }
}

const Definition = styled.div`
  border: 1px solid lightGray;
  margin: 20px;
  padding: 2px;
`;

function DefinitionExplorer({
  definition,
}: {
  definition: SDefinition<Typed | {}>;
}) {
  const normalizer = createVariableNormalizer();
  const type = (definition.node.value.info as any).resultingType;

  return (
    <Definition>
      <pre>Definition</pre> <pre>{definition.node.variable.name}</pre>
      {type && (
        <div>
          Type <Type type={type} normalizer={normalizer} />
        </div>
      )}
      <GenericSyntaxExplorer
        syntax={definition.node.value}
        normalizer={normalizer}
      />
    </Definition>
  );
}

const ViewButton = styled.button`
  ${(props: { selected?: boolean }) =>
    props.selected &&
    css`
      background: lightBlue;
    `}
`;

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

  .boolean {
    color: red;
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

function getDisplayExpressionType(
  expr: Expression<Typed>,
  normalizer: TypeVariableNormalizer
) {
  if (!expr.info.selfType) return undefined;
  return `${printTypeWithNormalizer(expr.info.selfType, normalizer)}`;
}

function Type({
  type,
  normalizer,
}: {
  type: Type;
  normalizer: TypeVariableNormalizer;
}) {
  return <span>`{printTypeWithNormalizer(type, normalizer)}`</span>;
}

function createPrettierEncoder(
  normalizer: TypeVariableNormalizer
): Encoder<React.ReactElement[]> {
  return {
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
              ? getDisplayExpressionType(source, normalizer)
              : undefined
          }
        >
          {x}
        </Token>,
      ];
    },
    concat: (...args: React.ReactElement[][]): React.ReactElement[] =>
      args.flat(1),
  };
}

function GenericSyntaxExplorer({
  syntax,
  normalizer,
}: {
  syntax: Syntax;
  normalizer: TypeVariableNormalizer;
}) {
  return (
    <Code>
      {pprintAs(syntax, LINE_WIDTH, createPrettierEncoder(normalizer))}
    </Code>
  );
}

export function App({
  state,
  dispatch,
}: {
  state: State;
  dispatch: React.Dispatch<Action>;
}) {
  return (
    <div>
      <h1>Liphe</h1>
      <Editor
        value={state.code}
        onChange={(e) => dispatch(updateCode(e.target.value))}
      />
      <AST code={state.code} />
    </div>
  );
}

/* eslint-enable react/jsx-key */

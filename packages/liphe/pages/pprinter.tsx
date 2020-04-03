/* eslint-disable react/jsx-key */

import {
  inferModule,
  compileModuleToString,
  macroexpandModule,
  readModule,
} from "@delisp/core";
import React, { useState } from "react";
import styled, { css } from "styled-components";
import { PageLayout } from "../components/PageLayout";

import { ModuleExplorer } from "../components/PPrinter";

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

export default function App() {
  const [code, setCode] = useState("");
  return (
    <PageLayout>
      <h1>Liphe</h1>
      <Editor value={code} onChange={(e) => setCode(e.target.value)} />
      <AST code={code} />
    </PageLayout>
  );
}

/* eslint-enable react/jsx-key */

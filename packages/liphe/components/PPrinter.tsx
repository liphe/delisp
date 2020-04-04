/* eslint-disable react/jsx-key */

import {
  createVariableNormalizer,
  Encoder,
  Expression,
  isExpression,
  Module,
  pprintAs,
  printTypeWithNormalizer,
  SDefinition,
  Syntax,
  Type,
  Typed,
  TypeVariableNormalizer,
} from "@delisp/core";
import React from "react";
import styled from "styled-components";

const LINE_WIDTH = 40;

export function ModuleExplorer({ module: m }: { module: Module<Typed | {}> }) {
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
          Type <TypeExplorer type={type} normalizer={normalizer} />
        </div>
      )}
      <GenericSyntaxExplorer
        syntax={definition.node.value}
        normalizer={normalizer}
      />
    </Definition>
  );
}

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

function TypeExplorer({
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

export function GenericSyntaxExplorer({
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

/* eslint-enable react/jsx-key */

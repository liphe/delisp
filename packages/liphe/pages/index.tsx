import * as React from "react";
import { useState, useEffect, useContext } from "react";
import * as Delisp from "@delisp/core";
import { Typed } from "@delisp/core";
import { PageLayout } from "../components/PageLayout";

import { GenericSyntaxExplorer } from "./pprinter";

import styles from "./index.module.css";

const Context = React.createContext<
  ReturnType<typeof Delisp.createVariableNormalizer>
>(null as any);

export const ModuleExplorer: React.FC<{ module: Delisp.Module<Typed> }> = ({
  module,
}) => {
  return (
    <div className={styles.module}>
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

export const SyntaxExplorer: React.FC<{ syntax: Delisp.Syntax<Typed> }> = ({
  syntax,
}) => {
  const normalizer = useContext(Context);
  const content = Delisp.isExpression(syntax) ? (
    <ExpressionExplorer expression={syntax} />
  ) : (
    <GenericSyntaxExplorer syntax={syntax} normalizer={normalizer} />
  );
  return <div>{content}</div>;
};

export const ExpressionExplorer: React.FC<{
  expression: Delisp.Expression<Typed>;
}> = ({ expression }) => {
  switch (expression.node.tag) {
    case "number":
      return (
        <NumberExplorer value={{ ...expression, node: expression.node }} />
      );
    case "string":
      return (
        <StringExplorer value={{ ...expression, node: expression.node }} />
      );
    case "none":
      return <NoneExplorer value={{ ...expression, node: expression.node }} />;
    case "boolean":
      return (
        <BooleanExplorer value={{ ...expression, node: expression.node }} />
      );
    case "function":
      return <FunctionExplorer fn={{ ...expression, node: expression.node }} />;
    case "record":
      return (
        <RecordExplorer record={{ ...expression, node: expression.node }} />
      );
    default: {
      const normalizer = useContext(Context);
      return (
        <GenericSyntaxExplorer syntax={expression} normalizer={normalizer} />
      );
    }
  }
};

export const NumberExplorer: React.FC<{ value: Delisp.SNumber }> = ({
  value,
}) => {
  const n = value.node.value;
  return (
    <span title={`{n} = 0x${n.toString(16)} = b${n.toString(2)}`}>{n}</span>
  );
};

export const StringExplorer: React.FC<{ value: Delisp.SString }> = ({
  value,
}) => {
  return <span>&quot;{value.node.value}&quot;</span>;
};

export const BooleanExplorer: React.FC<{ value: Delisp.SBoolean }> = ({
  value,
}) => {
  return <span>{value.node.value}</span>;
};

export const NoneExplorer: React.FC<{ value: Delisp.SNone }> = () => {
  return <span>none</span>;
};

export const RecordExplorer: React.FC<{
  record: Delisp.SRecord<Typed>;
}> = ({ record }) => {
  return (
    <div className={styles.record}>
      {"{"}
      <ul>
        {record.node.fields.map((field) => {
          return (
            <li key={field.label.name}>
              <IdentifierExplorer identifier={field.label} />{" "}
              <SyntaxExplorer syntax={field.value} />
            </li>
          );
        })}
      </ul>
      {"}"}
    </div>
  );
};

export const FunctionExplorer: React.FC<{ fn: Delisp.SFunction<Typed> }> = ({
  fn,
}) => {
  const selfType = fn.info.selfType;
  if (!Delisp.isFunctionType(selfType)) {
    throw new Error("The type of a function is not a function type??");
  }
  const type = Delisp.decomposeFunctionType(selfType);

  const [, ...args] = fn.node.lambdaList.positionalArguments;
  const [contextType, ...argsTypes] = type.args;

  const isUnconstraintContext =
    Delisp.isTVar(contextType) &&
    Delisp.countTypeOccurrences(contextType, selfType) === 1;

  const effects = Delisp.normalizeEffect(type.effect).fields.map(
    (f) => f.label
  );

  return (
    <div className={styles.function}>
      <span className={styles.functionLabel}>λ</span>

      {isUnconstraintContext ? null : (
        <div>
          <strong>*context*</strong> - <TypeExplorer type={contextType} />
        </div>
      )}

      <div>
        <strong>Arguments:</strong>
        <ul className={styles.functionArguments}>
          {args.map((arg, argPosition) => {
            return (
              <li key={arg.name}>
                <IdentifierExplorer identifier={arg} /> -{" "}
                <TypeExplorer type={argsTypes[argPosition]} />
              </li>
            );
          })}
        </ul>
      </div>

      {effects.length === 0 ? null : (
        <div>
          <strong>Effects:</strong>
          <ul className={styles.effects}>
            {effects.map((eff, effPosition) => {
              return <li key={effPosition}>{eff}</li>;
            })}
          </ul>
        </div>
      )}

      <div>
        <strong>Output:</strong>
        <TypeExplorer type={type.output} />
      </div>

      {fn.node.body.map((expr, i) => {
        return <SyntaxExplorer key={i} syntax={expr} />;
      })}
    </div>
  );
};

export const TypeExplorer: React.FC<{ type: Delisp.Type }> = ({ type }) => {
  const normalizer = useContext(Context);
  return (
    <span className="type">
      {Delisp.printTypeWithNormalizer(type, normalizer)}
    </span>
  );
};

export const IdentifierExplorer: React.FC<{
  identifier: Delisp.Identifier;
}> = ({ identifier }) => {
  return (
    <code>
      <span className={styles.identifier}>{identifier.name}</span>
    </code>
  );
};

export default function Homepage() {
  const [code, setCode] = useState(`
(lambda (x)
  (+ *context* x)
  )`);

  const [module, setModule] = useState<Delisp.Module<Typed>>();
  const [hasErrors, setHasErrors] = useState(false);

  useEffect(() => {
    try {
      const module = Delisp.macroexpandModule(Delisp.readModule(code));
      const { typedModule } = Delisp.inferModule(module);
      setHasErrors(false);
      setModule(typedModule);
    } catch (err) {
      console.error(err);
      setHasErrors(true);
    }
  }, [code]);

  return (
    <div>
      <PageLayout>
        <textarea
          value={code}
          onChange={(event) => {
            setCode(event.target.value);
          }}
        />
        {hasErrors && "with errors!"}
        {module && <ModuleExplorer module={module} />}
      </PageLayout>
    </div>
  );
}

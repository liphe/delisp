import * as Delisp from "@delisp/core";
import { Typed } from "@delisp/core";
import * as React from "react";
import { useEffect, useState } from "react";

import { ModuleExplorer } from "../components/Explorer/Module";
import { PageLayout } from "../components/PageLayout";

export default function Homepage() {
  const [code, setCode] = useState(`
(lambda (f x)
  (print x)
  (f)
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

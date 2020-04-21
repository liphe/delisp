import * as Delisp from "@delisp/core";
import { Typed } from "@delisp/core";
import * as React from "react";
import { useEffect, useState } from "react";

import { ModuleExplorer } from "../components/Explorer/Module";
import { Cursor } from "../components/Explorer/utils/Cursor";
import { PageLayout } from "../components/PageLayout";
import styles from "./index.module.css";

export default function Homepage() {
  const [code, setCode] = useState(`
(define f
   (lambda (n)
     (if (= n 0)
         1
(* n (f (- n 1 ))))))
`);

  const [untypedModule, setUntypedModule] = useState<Delisp.Module>();
  const [hasErrors, setHasErrors] = useState(false);

  useEffect(() => {
    try {
      const m = Delisp.macroexpandModule(Delisp.readModule(code));
      setUntypedModule(m);
    } catch (err) {
      console.error(err);
      setHasErrors(true);
    }
  }, [code]);

  const [module, setModule] = useState<Delisp.Module<Typed>>();
  useEffect(() => {
    if (!untypedModule) return;
    try {
      const { typedModule } = Delisp.inferModule(untypedModule);
      setModule(typedModule);
      setHasErrors(false);
    } catch (err) {
      setHasErrors(true);
    }
  }, [untypedModule]);

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
        <div className={styles.code}>
          {module && (
            <ModuleExplorer cursor={new Cursor(module, setUntypedModule)} />
          )}
        </div>
      </PageLayout>
    </div>
  );
}

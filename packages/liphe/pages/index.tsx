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
(define id (lambda (x) x))

(define >>>
  (lambda (f1 f2)
    (lambda (x) (f2 (f1 x)))))

(define over
  (lambda (lens fn x)
    (multiple-value-bind (current change)
        (lens x)
      (change (fn current)))))

(define constantly
  (lambda (x) (lambda (y) x)))

(define set
  (lambda (lens value container)
    (over lens
          (constantly value)
          container)))

(define >>
  (lambda (outer inner)
    (lambda (outer-container)
      (multiple-value-bind (inner-container outer-update)
          (outer outer-container)
        (multiple-value-bind (value inner-update)
            (inner inner-container)
          (values value
                  (>>> inner-update
                       outer-update)))))))

(define fst
  (lambda (p)
    (values (%fst p)
            (lambda (new-value)
              (pair new-value (%snd p))))))

(define snd
  (lambda (p)
    (values (%snd p)
            (lambda (new-value)
              (pair (%fst p) new-value)))))

(define string-ref
  (lambda (k) (substring k (+ k 1))))


(export [id
         >>
         fst
         snd
         string-ref
         >>>
         over
         constantly
         set])

`);

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
        <div className={styles.code}>
          {module && <ModuleExplorer cursor={new Cursor(module, setModule)} />}
        </div>
      </PageLayout>
    </div>
  );
}

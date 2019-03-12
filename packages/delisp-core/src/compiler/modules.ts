import * as JS from "estree";
import { member } from "./estree-utils";
import { identifierToJS } from "./jsvariable";

import { printHighlightedExpr } from "../error-report";
import { SExport } from "../syntax";

export interface ModuleBackend {
  export(
    name: string,
    value: JS.Expression,
    exp: SExport
  ): JS.Statement | JS.ModuleDeclaration;
}

export const cjs: ModuleBackend = {
  export(name, value) {
    return {
      type: "ExpressionStatement",
      expression: {
        type: "AssignmentExpression",
        operator: "=",
        left: member(
          {
            type: "MemberExpression",
            computed: false,
            object: { type: "Identifier", name: "module" },
            property: { type: "Identifier", name: "exports" }
          },
          identifierToJS(name)
        ),
        right: value
      }
    };
  }
};

export const esm: ModuleBackend = {
  export(name, value, exp) {
    if (value.type !== "Identifier") {
      throw new Error(
        printHighlightedExpr(
          "Only user defined symbols can be exported",
          exp.value.location
        )
      );
    }
    return {
      type: "ExportNamedDeclaration",
      exportKind: "value",
      specifiers: [
        {
          type: "ExportSpecifier",
          local: value,
          exported: { type: "Identifier", name: identifierToJS(name) }
        }
      ],
      declaration: null
    };
  }
};

import { InvariantViolation } from "./invariant";

import { escapeIdentifier } from "./compiler/jsvariable";

import {
  isExport,
  SDefinition,
  STypeAlias,
  Syntax,
  Typed,
  Module
} from "./syntax";

import { Monotype, Type } from "./types";
import { generalize, normalizeRow } from "./type-utils";
import { printType } from "./type-printer";

interface TAppHandler {
  (args: Monotype[], mapping: TSMapping): string;
}

type TSMapping = Array<{
  delispName: string;
  tsName: string;
}>;

function generateFn(args: Monotype[], mapping: TSMapping): string {
  const argTypes = args.slice(0, -1);
  const returnType = args[args.length - 1];
  return (
    "(" +
    argTypes
      .map((t, i) => `arg${i + 1}: ${generateTSMonotype(t, mapping)}`)
      .join(", ") +
    `) => ${generateTSMonotype(returnType, mapping)}`
  );
}

function generateVector([arg]: Monotype[], mapping: TSMapping): string {
  return `Array<${generateTSMonotype(arg, mapping)}>`;
}

function generateRecord([arg]: Monotype[], mapping: TSMapping): string {
  const normalizedRow = normalizeRow(arg);
  return (
    "{" +
    normalizedRow.fields
      .map(
        ({ label, labelType }) =>
          `${label}: ${generateTSMonotype(labelType, mapping)};`
      )
      .join("\n") +
    "}"
  );
}

const generateTApps: { [name: string]: TAppHandler } = {
  vector: generateVector,
  record: generateRecord,
  "->": generateFn
};

export function generateTSMonotype(t: Monotype, mapping: TSMapping): string {
  switch (t.type) {
    case "void":
      return "void";
    case "boolean":
      return "boolean";
    case "number":
      return "number";
    case "string":
      return "string";
    case "application": {
      const handler = generateTApps[t.op];
      if (!handler) {
        throw new Error(
          `Doesn't know how to generate Typescript type for ${printType(t)}`
        );
      }
      return handler(t.args, mapping);
    }

    case "empty-row":
    case "row-extension":
      throw new InvariantViolation(
        `Row types can't be converted directly to Typescript. Only records can.`
      );

    case "user-defined-type":
      return escapeIdentifier(t.name);

    case "type-variable":
      const entry = mapping.find(e => e.delispName === t.name);
      if (!entry) {
        throw new InvariantViolation(
          `Type variable is not in the mapping list.`
        );
      }
      return entry.tsName;
  }
}

function generateTSType(t: Type): string {
  const mapping = t.tvars.map((varname, i) => ({
    delispName: varname,
    tsName: `T${i + 1}`
  }));

  if (mapping.length === 0) {
    return generateTSMonotype(t.mono, mapping);
  } else {
    const generics = mapping.map(e => e.tsName).join(",");
    return `<${generics}>${generateTSMonotype(t.mono, mapping)}`;
  }
}

export function generateTSDeclaration(
  s: SDefinition<Typed> | STypeAlias<Typed>
): string {
  switch (s.type) {
    case "definition": {
      const varname = escapeIdentifier(s.variable);
      const typ = generateTSType(generalize(s.value.info.type, []));
      return `declare const ${varname}: ${typ};`;
    }
    case "type-alias": {
      const typename = escapeIdentifier(s.name);
      const typ = generateTSType(generalize(s.definition, []));
      return `type ${typename} = ${typ};`;
    }
  }
}

function exportIf(flag: boolean, code: string) {
  return flag ? `export ${code}` : code;
}

function isExported(name: string, m: Module): boolean {
  const exports = m.body.filter(isExport);
  return exports.find(e => e.value.name === name) !== undefined;
}

/** Generate Typescript declaration module for a Delisp module. */
export function generateTSModuleDeclaration(m: Module<Typed>): string {
  function isGenerable(
    x: Syntax<Typed>
  ): x is SDefinition<Typed> | STypeAlias<Typed> {
    return x.type === "definition" || x.type === "type-alias";
  }

  const declarations = m.body.filter(isGenerable);
  return (
    declarations
      .map(d => {
        const tstype = generateTSDeclaration(d);
        const active = d.type === "definition" && isExported(d.variable, m);
        return exportIf(active, tstype);
      })
      .join("\n") +
    `

export {}
`
  );
}

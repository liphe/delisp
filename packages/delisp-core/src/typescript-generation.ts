import { InvariantViolation } from "./invariant";

import { identifierToJS } from "./compiler/jsvariable";

import {
  isExport,
  SDefinition,
  STypeAlias,
  Syntax,
  Typed,
  Module
} from "./syntax";

import { Type, TypeSchema } from "./types";
import { generalize, normalizeRow } from "./type-utils";
import { printType } from "./type-printer";

interface TAppHandler {
  (args: Type[], mapping: TSMapping): string;
}

type TSMapping = Array<{
  delispName: string;
  tsName: string;
}>;

function generateFn(args: Type[], mapping: TSMapping): string {
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

function generateVector([arg]: Type[], mapping: TSMapping): string {
  return `Array<${generateTSMonotype(arg, mapping)}>`;
}

function generateRecord([arg]: Type[], mapping: TSMapping): string {
  const normalizedRow = normalizeRow(arg);
  return (
    "{" +
    normalizedRow.fields
      .map(({ label, labelType }) => {
        if (!label.startsWith(":")) {
          throw new InvariantViolation(
            `Field name must start with colon (:), but found ${label}.`
          );
        }
        const labelName = label.slice(1);
        return `${labelName}: ${generateTSMonotype(labelType, mapping)};`;
      })
      .join("\n") +
    "}"
  );
}

const generateTApps: { [name: string]: TAppHandler } = {
  vector: generateVector,
  record: generateRecord,
  "->": generateFn
};

export function generateTSMonotype(t: Type, mapping: TSMapping): string {
  switch (t.tag) {
    case "constant": {
      switch (t.name) {
        case "void":
          return "void";
        case "boolean":
          return "boolean";
        case "number":
          return "number";
        case "string":
          return "string";
        default:
          return identifierToJS(t.name);
      }
    }

    case "application": {
      if (t.op.tag !== "constant") {
        throw new Error(
          `Cannot generate a Typescript for a type application to ${printType(
            t.op
          )}`
        );
      }
      const handler = generateTApps[t.op.name];
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

function generateTSType(t: TypeSchema): string {
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
  switch (s.tag) {
    case "definition": {
      const varname = identifierToJS(s.variable.name);
      const typ = generateTSType(generalize(s.value.info.type, []));
      return `declare const ${varname}: ${typ};`;
    }
    case "type-alias": {
      const typename = identifierToJS(s.name);
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
    return x.tag === "definition" || x.tag === "type-alias";
  }

  const declarations = m.body.filter(isGenerable);
  return (
    declarations
      .map(d => {
        const tstype = generateTSDeclaration(d);
        const active = d.tag === "definition" && isExported(d.variable.name, m);
        return exportIf(active, tstype);
      })
      .join("\n") +
    `

export {}
`
  );
}

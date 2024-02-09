import fs from "fs";
import path from "path";

// TS Types

interface TSRawType {
  tag: "primitive";
  raw: string;
}
interface TSArrayType {
  tag: "array";
  elements: TSType;
}

interface TSRecordField {
  key: string;
  type: TSType;
}

interface TSRecordType {
  tag: "record";
  fields: TSRecordField[];
}
type TSType = TSRawType | TSArrayType | TSRecordType;

function tstype(raw: string): TSRawType {
  return { tag: "primitive", raw };
}

function tsArray(t: TSType): TSArrayType {
  return { tag: "array", elements: t };
}

function tsRecord(fields: TSRecordType["fields"]): TSRecordType {
  return { tag: "record", fields };
}

function tsContains(E: TSRawType, t: TSType): boolean {
  switch (t.tag) {
    case "primitive":
      return t.raw === E.raw;
    case "array":
      return tsContains(E, t.elements);
    case "record":
      return t.fields.some((f) => tsContains(E, f.type));
  }
}

function printTSType(t: TSType): string {
  switch (t.tag) {
    case "primitive":
      return t.raw;
    case "array":
      return `Array<${printTSType(t.elements)}>`;
    case "record":
      return `{
            ${t.fields
              .map((f) => f.key + ": " + printTSType(f.type) + ";")
              .join("\n")}
        }`;
  }
}

// ADT

interface ADTAlternative {
  tag: string;
  record: TSRecordType;
}

interface ADT {
  tag: "adt";
  name: string;
  generics: TSRawType[];
  alternatives: ADTAlternative[];
  type: TSRawType;
}

function tsADT(
  name: string,
  generics: TSRawType[],
  alternatives: {
    [tag: string]: {
      [field: string]: TSType;
    };
  }
): ADT {
  return {
    tag: "adt",
    name,
    generics,
    alternatives: Object.keys(alternatives).map((tag) => {
      return {
        tag,
        record: tsRecord(
          Object.keys(alternatives[tag]).map((key) => ({
            key,
            type: alternatives[tag][key],
          }))
        ),
      };
    }),
    type: tstype(name),
  };
}

function printADT(adt: ADT): string {
  const alternativeData = (alt: ADTAlternative) => {
    const generics = adt.generics.map((t) =>
      tsContains(t, alt.record) ? t.raw : "_" + t.raw
    );
    const name = `S${alt.tag}F`;
    const nameWithGenerics = `${name}<${generics.join(", ")}>`;
    return {
      name,
      generics,
      nameWithGenerics: generics.length === 0 ? name : nameWithGenerics,
    };
  };

  const alternatives = adt.alternatives
    .map((alt) => {
      const altData = alternativeData(alt);

      const taggedRecord = tsRecord([
        {
          key: "tag",
          type: tstype(`"${alt.tag[0].toLowerCase() + alt.tag.slice(1)}"`),
        },
        ...alt.record.fields,
      ]);

      return `
        export interface ${altData.nameWithGenerics}
          ${printTSType(taggedRecord)}
        `;
    })
    .join("\n");

  const generics =
    adt.generics.length === 0
      ? ""
      : `<${adt.generics.map((g) => g.raw).join(", ")}>`;

  const union = `
  export type ${printTSType(adt.type)}${generics} = ${adt.alternatives
    .map(alternativeData)
    .map((d) => `${d.name}${generics}`)
    .join(" | ")};
  `;

  return `
   ${alternatives}
   ${union}
   `;
}

const E = tstype("E");

const Identifier = tsADT("Identifier", [], {
  Identifier: { name: tstype("string"), location: tstype("Location") },
});

const LambdaList = tsADT("LambdaList", [], {
  LambdaList: {
    positionalArguments: tsArray(Identifier.type),
    location: tstype("Location"),
  },
});

const Expression = tsADT("FutureExpression", [E], {
  Number: { value: tstype("number") },
  String: { value: tstype("string") },
  Boolean: { value: tstype("boolean") },
  None: {},
  Conditional: {
    condition: E,
    consequent: E,
    alternative: E,
  },
  Function: { lambdaList: LambdaList.type, body: tsArray(E) },
});

const output = `
// This file is generated
import { Location } from "./input";

${printADT(Identifier)}
${printADT(LambdaList)}
${printADT(Expression)}
`;

fs.writeFileSync(path.join(__dirname, "src/syntax-generated.ts"), output);

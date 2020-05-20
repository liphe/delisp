// import * as ts from "typescript";
import { ASExpr } from "./src/sexpr";
import { readAllFromString } from "./src/reader";

const example = `
(define String {:value string})
(define Number {:value number})
(define Vector {:elements [Expression] })
(define Expression String Number Vector)
`;

const getKeywordName = (keyword: string): string => {
  if (keyword[0] !== ":") {
    throw new Error(`Keywords should start with a : (${keyword})`);
  }
  return keyword.slice(1);
};

const getSymbolName = (symb: ASExpr): string => {
  if (symb.tag !== "symbol") {
    throw new Error("Expected a symbol");
  }
  return symb.name;
};

const generateTSType = (type: ASExpr): string => {
  switch (type.tag) {
    case "symbol":
      return type.name;
    case "vector":
      return `Array<${generateTSType(type.elements[0])}>`;
    case "map":
      return generateTSObject(type);
    default:
      throw new Error("not a valid type");
  }
};

const generateTSObject = (type: ASExpr, tagName?: string): string => {
  if (type.tag !== "map") {
    throw new Error("");
  }

  const tag = tagName ? `tag: "${tagName}", ` : "";

  return `{ ${tag}${type.fields
    .map(
      (field) =>
        `${getKeywordName(field.label.name)}: ${generateTSType(field.value)}`
    )
    .join(",\n")} }`;
};

const generateTSDefinitions = (declarations: ASExpr[]): string => {
  return declarations
    .map((decl) => {
      if (decl.tag !== "list") {
        throw new Error("Toplevel declarations should be a list");
      }
      const op = decl.elements[0];
      const args = decl.elements.slice(1);
      if (op.tag !== "symbol") {
        throw new Error(`Operator should be a symbol ${op}`);
      }

      switch (op.name) {
        case "define":
          const name = getSymbolName(args[0]);
          const def = args.slice(1);

          if (def.length === 1) {
            return `interface ${name} ${def.map((a) =>
              generateTSObject(a, name)
            )}`;
          } else {
            return `type ${name} = ${def
              .map((a) => generateTSType(a))
              .join(" | ")};`;
          }
        default:
          throw new Error(`unknown operation: ${op.name}`);
      }
    })
    .join("\n");
};

// console.dir(readAllFromString("(foo 1 2)"), { depth: null });

console.log(generateTSDefinitions(readAllFromString(example)));

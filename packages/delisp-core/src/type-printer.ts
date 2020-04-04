import { decomposeFunctionType, normalizeRow } from "./type-utils";
import * as T from "./types";
import { range } from "./utils";

function typeIndexName(index: number): string {
  const alphabet = "αβγδεζηθικμνξοπρστυφχψ";
  return index < alphabet.length
    ? alphabet[index]
    : `ω${index - alphabet.length + 1}`;
}

export type TypeVariableNormalizer = (t: T.Var) => string;

export function createVariableNormalizer(): TypeVariableNormalizer {
  const variables: string[] = [];

  return (t: T.Var): string => {
    let idx = variables.indexOf(t.node.name);
    if (idx === -1) {
      idx = variables.length;
      variables.push(t.node.name);
    }
    return typeIndexName(idx);
  };
}

function printValuesType(
  fnout: T.Type,
  normalizeVar: TypeVariableNormalizer,
  simplify = false
): string {
  const row = normalizeRow(fnout);
  // primary value only
  if (
    simplify &&
    row.fields.length === 1 &&
    row.fields[0].label === "0" &&
    row.extends.node.tag === "empty-row"
  ) {
    return printTypeWithNormalizer(row.fields[0].labelType, normalizeVar);
  } else {
    // full form (values a b c ...)
    return (
      "(values " +
      range(row.fields.length)
        .map((i) => {
          const field = row.fields.find((f) => f.label === String(i))!;
          return printTypeWithNormalizer(field.labelType, normalizeVar);
        })
        .join(" ") +
      (row.extends.node.tag === "empty-row"
        ? ""
        : " <| " + printTypeWithNormalizer(row.extends, normalizeVar)) +
      ")"
    );
  }
}

function printApplicationType(
  type: T.Application,
  normalizeVar: TypeVariableNormalizer,
  simplify = false
): string {
  function genericApp(op: T.Type, args: T.Type[]): string {
    return (
      "(" +
      [op, ...args]
        .map((t) => printTypeWithNormalizer(t, normalizeVar))
        .join(" ") +
      ")"
    );
  }

  if (type.node.op.node.tag === "constant") {
    switch (type.node.op.node.name) {
      case "vector": {
        return `[${printTypeWithNormalizer(type.node.args[0], normalizeVar)}]`;
      }
      case "record": {
        const arg = type.node.args[0];
        const row = normalizeRow(arg);
        const fields = row.fields
          .map(
            (f) =>
              `${f.label} ${printTypeWithNormalizer(f.labelType, normalizeVar)}`
          )
          .join(" ");
        const extension =
          row.extends.node.tag !== "empty-row"
            ? ` <| ${printTypeWithNormalizer(row.extends, normalizeVar)}`
            : "";
        return `{${fields}${extension}}`;
      }
      case "effect": {
        const row = normalizeRow(type.node.args[0]);
        if (
          simplify &&
          row.fields.length === 0 &&
          row.extends.node.tag === "type-variable"
        ) {
          return printTypeWithNormalizer(row.extends, normalizeVar, simplify);
        }

        const fields = row.fields.map((f) => " " + f.label).join("");
        const extending =
          row.extends.node.tag === "empty-row"
            ? ""
            : " <| " + printTypeWithNormalizer(row.extends, normalizeVar);

        return `(effect${fields}${extending})`;
      }

      case "cases": {
        const arg = type.node.args[0];
        const row = normalizeRow(arg);
        const fields = row.fields
          .map((f) =>
            f.labelType.node.tag === "constant" &&
            f.labelType.node.name === "void"
              ? `${f.label}`
              : `(${f.label} ${printTypeWithNormalizer(
                  f.labelType,
                  normalizeVar
                )})`
          )
          .join(" ");
        const extension =
          row.extends.node.tag !== "empty-row"
            ? ` ${printTypeWithNormalizer(row.extends, normalizeVar)}`
            : "";
        return `(cases ${fields}${extension})`;
      }

      case "values":
        return printValuesType(type.node.args[0], normalizeVar, simplify);

      case "->": {
        const { args, effect, output } = decomposeFunctionType(type);
        return (
          "(->" +
          args
            .map((t) => " " + printTypeWithNormalizer(t, normalizeVar))
            .join("") +
          " " +
          printTypeWithNormalizer(effect, normalizeVar, true) +
          " " +
          printTypeWithNormalizer(output, normalizeVar, true) +
          ")"
        );
      }

      default: {
        return genericApp(type.node.op, type.node.args);
      }
    }
  } else {
    return genericApp(type.node.op, type.node.args);
  }
}

export function printTypeWithNormalizer(
  type: T.Type,
  normalizeVar: TypeVariableNormalizer,
  simplify = false
): string {
  switch (type.node.tag) {
    case "constant":
      return type.node.name;
    case "application":
      return printApplicationType({ node: type.node }, normalizeVar, simplify);
    case "type-variable":
      return normalizeVar({ node: type.node });
    case "empty-row":
      return "#<empty-row>";
    case "row-extension":
      return `(#<row-extend> ${type.node.label} ${printTypeWithNormalizer(
        type.node.labelType,
        normalizeVar
      )} <| ${printTypeWithNormalizer(type.node.extends, normalizeVar)}})`;
  }
}

export function printType(rawType: T.Type, normalize = true) {
  const normalizeVar = normalize
    ? createVariableNormalizer()
    : (t: T.Var) => t.node.name;
  return printTypeWithNormalizer(rawType, normalizeVar);
}

import { InvariantViolation } from "./invariant";
import { range } from "./utils";
import { TApplication, Type, TVar } from "./types";
import { normalizeRow } from "./type-utils";

function typeIndexName(index: number): string {
  const alphabet = "αβγδεζηθικμνξοπρστυφχψ";
  return index < alphabet.length
    ? alphabet[index]
    : `ω${index - alphabet.length + 1}`;
}

function createVariableNormalizer() {
  let variables: string[] = [];

  return (t: TVar): string => {
    let idx = variables.indexOf(t.node.name);
    if (idx === -1) {
      idx = variables.length;
      variables.push(t.node.name);
    }
    return typeIndexName(idx);
  };
}

function printValuesType(
  fnout: Type,
  normalizeVar: (t: TVar) => string,
  simplify = false
): string {
  const row = normalizeRow(fnout);

  // primary value only
  if (simplify && row.fields.length === 1 && row.fields[0].label === "0") {
    return _printType(row.fields[0].labelType, normalizeVar);
  } else {
    // full form (values a b c ...)
    return (
      "(values " +
      range(row.fields.length)
        .map(i => {
          const field = row.fields.find(f => f.label === String(i))!;
          return _printType(field.labelType, normalizeVar);
        })
        .join(" ") +
      (row.extends.node.tag === "empty-row"
        ? ""
        : "| " + _printType(row.extends, normalizeVar)) +
      ")"
    );
  }
}

function printApplicationType(
  type: TApplication,
  normalizeVar: (t: TVar) => string,
  simplify = false
): string {
  function genericApp(op: Type, args: Type[]): string {
    return (
      "(" + [op, ...args].map(t => _printType(t, normalizeVar)).join(" ") + ")"
    );
  }

  if (type.node.op.node.tag === "constant") {
    switch (type.node.op.node.name) {
      case "vector": {
        return `[${_printType(type.node.args[0], normalizeVar)}]`;
      }
      case "record": {
        const arg = type.node.args[0];
        const row = normalizeRow(arg);
        const fields = row.fields
          .map(f => `${f.label} ${_printType(f.labelType, normalizeVar)}`)
          .join(" ");
        const extension =
          row.extends.node.tag !== "empty-row"
            ? ` | ${_printType(row.extends, normalizeVar)}`
            : "";
        return `{${fields}${extension}}`;
      }
      case "effect": {
        const row = normalizeRow(type.node.args[0]);

        const fields = row.fields.map(f => " " + f.label).join("");
        const extending =
          row.extends.node.tag === "empty-row"
            ? ""
            : " | " + _printType(row.extends, normalizeVar);

        return `(effect${fields}${extending})`;
      }

      case "cases": {
        const arg = type.node.args[0];
        const row = normalizeRow(arg);
        const fields = row.fields
          .map(f =>
            f.labelType.node.tag === "constant" &&
            f.labelType.node.name === "void"
              ? `${f.label}`
              : `(${f.label} ${_printType(f.labelType, normalizeVar)})`
          )
          .join(" ");
        const extension =
          row.extends.node.tag !== "empty-row"
            ? ` ${_printType(row.extends, normalizeVar)}`
            : "";
        return `(cases ${fields}${extension})`;
      }

      case "values":
        return printValuesType(type.node.args[0], normalizeVar, simplify);

      case "->": {
        const { op, args } = type.node;
        return (
          "(" +
          [op, ...args]
            .map((t, i) => _printType(t, normalizeVar, i === args.length))
            .join(" ") +
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

function _printType(
  type: Type,
  normalizeVar: (t: TVar) => string,
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
    case "row-extension":
      throw new InvariantViolation(`Can't print ${type.node.tag} types`);
  }
}

function printTypeWithOptionalNormalization(rawType: Type, normalize = true) {
  const normalizeVar = normalize
    ? createVariableNormalizer()
    : (t: TVar) => t.node.name;
  return _printType(rawType, normalizeVar);
}

export { printTypeWithOptionalNormalization as printType };

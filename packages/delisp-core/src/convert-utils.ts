import { printHighlightedExpr } from "./error-report";
import { ASExpr, ASExprMap, ASExprSymbol } from "./sexpr";
import { duplicatedItemsBy, last } from "./utils";

export class ConvertError extends Error {}

export interface ParseRecordResult {
  fields: Array<{
    label: ASExprSymbol;
    value: ASExpr;
  }>;
  tail: ASExpr | undefined;
}

export function parseRecord(expr: ASExprMap): ParseRecordResult {
  //
  // Destructure a map into fields and tail
  function fieldsAndTail() {
    if (expr.fields.length === 0) {
      return { fields: expr.fields };
    } else {
      const lastField = last(expr.fields)!;
      return lastField.label.name === "|"
        ? {
            fields: expr.fields.slice(0, -1),
            tail: lastField.value
          }
        : { fields: expr.fields };
    }
  }

  function checkInvalidFields() {
    const invalidFields = fields.filter(f => !f.label.name.startsWith(":"));
    if (invalidFields.length > 0) {
      const field = invalidFields[0];
      throw new ConvertError(
        printHighlightedExpr(
          `'${
            field.label.name
          }' is not a valid field name. Fields should start with ':' (colon).`,
          field.label.location
        )
      );
    }
  }

  const { fields, tail } = fieldsAndTail();
  checkInvalidFields();

  const duplicates = duplicatedItemsBy(fields, f => f.label.name);
  if (duplicates.length > 0) {
    throw new ConvertError(
      printHighlightedExpr("Duplicated label", duplicates[0].label.location)
    );
  }

  return { fields, tail };
}

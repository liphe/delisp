/**
 * Report errors in a user-friendly way
 */

import { ASExpr } from "./sexpr";

function repeatChar(ch: string, n: number): string {
  return Array(n)
    .fill(ch)
    .join("");
}

/** Print a error message with some highlighted piece of a source code */
export function printHighlightedSource(
  message: string,
  source: string,
  offset: number
) {
  const lines = source.split("\n");

  // Calculate the `line` and `column` (0 based) for this offset in
  // source.
  let line = 0;
  let remainingOffset = offset;
  while (lines.length > line && remainingOffset >= lines[line].length + 1) {
    remainingOffset -= lines[line].length;
    line++;
  }
  const column = remainingOffset;

  return [
    `file:${line + 1}:${column}: ${message}`,
    lines[line],
    repeatChar("-", column) + "^"
  ].join("\n");
}

/** Print a error message with expr highlighted. */
export function printHighlightedExpr(
  message: string,
  expr: ASExpr,
  end = false
) {
  const source = expr.location.input.toString();
  const offset = end ? expr.location.end - 1 : expr.location.start;
  return printHighlightedSource(message, source, offset);
}

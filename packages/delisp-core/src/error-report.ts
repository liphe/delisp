/**
 * Report errors in a user-friendly way
 */

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

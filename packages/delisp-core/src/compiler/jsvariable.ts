export function varnameToJS(x: string): string {
  const escapes = new Map(
    Object.entries({
      "!": "bang",
      "@": "at",
      "#": "sharp",
      $: "dollar",
      "%": "percent",
      "^": "caret",
      "&": "amp",
      "*": "star",
      "<": "lt",
      ">": "gt",
      "+": "plus",
      "-": "minus",
      "/": "div",
      "~": "tilde",
      "?": "q",
      "=": "eq"
    })
  );
  // Instead of escaping specific characters, we have a list of
  // allowed characters explicitly! That should make easier for us to
  // catch issues in the future.
  return x
    .split("")
    .map(ch => {
      if (/[a-zA-Z0-9_]/.test(ch)) {
        return ch;
      } else if (escapes.has(ch)) {
        const replacement: string = escapes.get(ch)!;
        return "$" + replacement + "$";
      } else {
        throw new Error(
          `Error: the variable ${x} contained a non-allowed character ${ch}.`
        );
      }
    })
    .join("");
}

export function varnameToJS(x: string): string {
  // This prefix is intended to avoid generating reserved Javascript
  // keywords. For instance, the Delisp variable `const` will be
  // translated to $const and not `const`.
  const prefix = "$";

  // Instead of escaping specific characters, we have a list of
  // allowed characters explicitly! That should make easier for us to
  // catch issues in the future.
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

  const escapeName = (name: string) => {
    return name
      .split("")
      .map((ch: string) => {
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
  };

  return `${prefix}${escapeName(x)}`;
}

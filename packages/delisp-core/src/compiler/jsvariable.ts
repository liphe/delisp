const reservedWords = [
  "arguments",
  "await",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "else",
  "enum",
  "eval",
  "export",
  "extends",
  "false",
  "finally",
  "for",
  "function",
  "if",
  "implements",
  "import",
  "in",
  "instanceof",
  "interface",
  "let",
  "new",
  "null",
  "package",
  "private",
  "protected",
  "public",
  "return",
  "static",
  "super",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "typeof",
  "var",
  "void",
  "while",
  "with",
  "yield"
];

// A valid IdentifierName can be used as a property on objects
// This RegEx is more restrictive than needed, but at least it
// does not return any false positives
export function isValidJSIdentifierName(x: string): boolean {
  return /^[_$a-zA-Z][_$a-zA-Z0-9]*$/.test(x);
}

// A valid Identifier is more restricting and does not allow reserved (key)words
export function isValidJSIdentifier(x: string): boolean {
  return isValidJSIdentifierName(x) && !reservedWords.includes(x);
}

export function escapeIdentifier(x: string): string {
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

export function identifierToJS(x: string): string {
  return isValidJSIdentifier(x) ? x : escapeIdentifier(x);
}

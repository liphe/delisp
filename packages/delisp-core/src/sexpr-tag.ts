import { readFromString } from "./reader";
import { ASExpr, ASExprSymbol } from "./sexpr";

function replaceSymbolsInASExpr(
  sexpr: ASExpr,
  replace: (symbol: ASExprSymbol) => ASExpr
) {
  function replaceIn(e: ASExpr): ASExpr {
    switch (e.tag) {
      case "number":
      case "string":
        return e;
      case "symbol": {
        return replace(e);
      }
      case "list":
        return {
          ...e,
          elements: e.elements.map(replaceIn),
        };
      case "vector":
        return {
          ...e,
          elements: e.elements.map(replaceIn),
        };
      case "map":
        return {
          ...e,
          fields: e.fields.map(({ label, value }) => {
            const newLabel = replaceIn(label);
            if (newLabel.tag !== "symbol") {
              throw new Error(
                `Can't replace a non-symbol into the key position of a map.`
              );
            }
            return {
              label: newLabel,
              value: replaceIn(value),
            };
          }),
        };
    }
  }
  return replaceIn(sexpr);
}

export function sexpr(
  chunks: TemplateStringsArray,
  ...placeholders: ASExpr[]
): ASExpr {
  const tmpvars = placeholders.map((_, i) => `delisp_tmpl_${i}`);

  const tmpstring = chunks.reduce(
    (pre, post, i) => `${pre} ${tmpvars[i - 1]}  ${post}`
  );

  const sexprTmpl = readFromString(tmpstring);

  return replaceSymbolsInASExpr(sexprTmpl, (s) => {
    const index = tmpvars.indexOf(s.name);
    return index < 0 ? s : placeholders[index];
  });
}

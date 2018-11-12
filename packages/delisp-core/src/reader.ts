import { Syntax } from "./syntax";

export function readFromString(input: string): Syntax {
  if (input === "true") {
    return { type: "LiteralBoolean", value: true };
  } else if (input === "false") {
    return { type: "LiteralBoolean", value: false };
  } else {
    return { type: "Variable", name: input };
  }
}

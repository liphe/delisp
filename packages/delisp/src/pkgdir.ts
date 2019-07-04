import path from "path";
import { sync as findUpSync } from "find-up";

const pkgJSON = findUpSync("package.json", { cwd: __dirname })!;
if (!pkgJSON) {
  throw new Error(`Couldn't find package.json for delisp package.`);
}

const pkgdir = path.dirname(pkgJSON);
export default pkgdir;

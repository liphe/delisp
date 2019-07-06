import path from "path";
import { readJSONFile } from "./fs-helpers";
import pkgdir from "./pkgdir";
import { createImportSyntax, decodeExternalEnvironment } from "@delisp/core";

import { getOutputFiles } from "./compile-output";

export async function generatePreludeImports() {
  const preludeFile = path.resolve(pkgdir, "lib/prelude.dl");
  const { infoFile } = await getOutputFiles(preludeFile);
  const preludeEnv = decodeExternalEnvironment(await readJSONFile(infoFile));
  const names = Object.keys(preludeEnv.variables);
  return names.map(n => createImportSyntax(n, preludeFile));
}

import path from "path";

export interface CompileFileResult {
  jsFile: string;
  infoFile: string;
  dtsFile: string;
}

export function getOutputFiles(file: string): CompileFileResult {
  const base = path.dirname(file);
  const OUTPUT_DIR = path.join(base, ".delisp", "build");

  const outFileSansExt = path.join(
    OUTPUT_DIR,
    path.relative(base, path.dirname(file)) +
      path.sep +
      path.basename(file, path.extname(file))
  );
  const jsFile = outFileSansExt + ".js";
  const infoFile = outFileSansExt + ".json";
  const dtsFile = outFileSansExt + ".d.ts";

  return { jsFile, infoFile, dtsFile };
}

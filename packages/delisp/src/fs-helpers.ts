import { promisify } from "util";
import fs from "fs";

export const readFile = promisify(fs.readFile);
export const writeFile = promisify(fs.writeFile);

export async function readJSONFile(path: string): Promise<unknown> {
  const content = await readFile(path, "utf-8");
  return JSON.parse(content);
}

export function writeJSONFile(path: string, content: unknown): Promise<void> {
  return writeFile(path, JSON.stringify(content, null, 2));
}

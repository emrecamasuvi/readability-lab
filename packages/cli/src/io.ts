import { readFileSync } from "node:fs";

export function loadJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    throw new Error(`Could not read JSON from ${path}: ${(e as Error).message}`);
  }
}

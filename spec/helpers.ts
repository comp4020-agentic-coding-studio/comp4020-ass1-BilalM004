import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { JSDOM } from "jsdom";

export const DIST = resolve("dist");

export function allFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? allFiles(path) : [path];
  });
}

export function loadDoc(path: string) {
  return new JSDOM(readFileSync(join(DIST, path), "utf8")).window.document;
}

// Astro inlines small stylesheets straight into the page rather than
// emitting a separate .css file, so check both.
export function builtCss(): string {
  const cssFiles = allFiles(DIST)
    .filter((path) => path.endsWith(".css"))
    .map((path) => readFileSync(path, "utf8"));
  return [...cssFiles, loadDoc("index.html").documentElement.outerHTML].join("\n");
}

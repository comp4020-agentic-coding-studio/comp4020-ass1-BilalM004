import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

// Checks for story structure step 1 (the start screen) against the built site.
const DIST = resolve("dist");
const doc = new JSDOM(readFileSync(join(DIST, "index.html"), "utf8")).window.document;

function allFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? allFiles(path) : [path];
  });
}

// Astro inlines small stylesheets straight into the page rather than
// emitting a separate .css file, so check both.
function builtCss(): string {
  const cssFiles = allFiles(DIST)
    .filter((path) => path.endsWith(".css"))
    .map((path) => readFileSync(path, "utf8"));
  return [...cssFiles, doc.documentElement.outerHTML].join("\n");
}

describe("start screen", () => {
  it("has a start button", () => {
    const button = doc.querySelector("#start-button");
    expect(button).toBeTruthy();
    expect(button?.textContent?.trim()).not.toBe("");
  });

  it("has an intro screen ready to reveal, hidden by default", () => {
    const intro = doc.querySelector('[data-screen="intro"]');
    expect(intro).toBeTruthy();
    expect(intro?.hasAttribute("hidden")).toBe(true);
  });

  it("renders a starfield", () => {
    expect(doc.querySelectorAll(".star").length).toBeGreaterThan(50);
  });
});

describe("resilience", () => {
  it("disables star animation under prefers-reduced-motion", () => {
    expect(builtCss()).toContain("prefers-reduced-motion");
  });
});

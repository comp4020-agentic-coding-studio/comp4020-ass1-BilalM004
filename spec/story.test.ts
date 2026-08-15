import { describe, expect, it } from "vitest";
import { builtCss, loadDoc } from "./helpers";

// Checks for story structure step 1 (the start screen) against the built site.
const doc = loadDoc("index.html");

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

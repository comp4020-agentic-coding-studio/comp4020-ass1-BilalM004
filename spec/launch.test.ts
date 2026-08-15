import { describe, expect, it } from "vitest";
import { builtCss, loadDoc } from "./helpers";

// Checks for story structure step 2/3 (choice point + launch cutscene)
// against the built site. These assert the HTML contract only -- the
// camera/scene animation itself isn't observable in static markup and is
// verified by opening the page, not by a jsdom unit test.
const doc = loadDoc("index.html");

describe("choice screen", () => {
  it("has a button into the special relativity path, hidden by default", () => {
    const choice = doc.querySelector('[data-screen="choice"]');
    expect(choice).toBeTruthy();
    expect(choice?.hasAttribute("hidden")).toBe(true);

    const button = doc.querySelector("#special-relativity-button");
    expect(button).toBeTruthy();
    expect(button?.textContent?.trim()).not.toBe("");
  });
});

describe("launch screen", () => {
  it("is ready to reveal, hidden by default", () => {
    const launch = doc.querySelector('[data-screen="launch"]');
    expect(launch).toBeTruthy();
    expect(launch?.hasAttribute("hidden")).toBe(true);
  });

  it("has exactly one canvas for the cutscene", () => {
    const launch = doc.querySelector('[data-screen="launch"]');
    expect(launch?.querySelectorAll("canvas").length).toBe(1);
  });

  it("announces stage captions politely", () => {
    const launch = doc.querySelector('[data-screen="launch"]');
    expect(launch?.querySelector('[aria-live="polite"]')).toBeTruthy();
  });

  it("has a reachable, enabled skip button", () => {
    const skip = doc.querySelector("#launch-skip-button");
    expect(skip?.tagName).toBe("BUTTON");
    expect(skip?.hasAttribute("hidden")).toBe(false);
    expect((skip as HTMLButtonElement | null)?.disabled).toBe(false);
    expect(skip?.textContent?.trim()).not.toBe("");
  });
});

describe("resilience", () => {
  it("ships the ground-sequence and reduced-motion styles", () => {
    const css = builtCss();
    expect(css).toContain("rocket-liftoff");
    expect(css).toContain("prefers-reduced-motion");
  });
});

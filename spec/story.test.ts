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

describe("progress rail", () => {
  it("has exactly one step per stage of the story, in order", () => {
    const steps = [...doc.querySelectorAll(".progress-step")].map((el) => el.getAttribute("data-step"));
    expect(steps).toEqual(["start", "twins", "choice", "compare", "reunion", "explain"]);
  });

  it("starts with the start step marked as current", () => {
    const current = doc.querySelectorAll('.progress-step-button[aria-current="step"]');
    expect(current).toHaveLength(1);
    expect(current[0]?.getAttribute("data-step")).toBe("start");
  });

  it("labels the rail for screen reader users", () => {
    const rail = doc.querySelector(".progress-rail");
    expect(rail?.getAttribute("aria-label")?.trim()).not.toBe("");
  });

  it("keeps every step button enabled, so the rail can jump ahead as well as back", () => {
    const buttons = [...doc.querySelectorAll<HTMLButtonElement>(".progress-step-button")];
    expect(buttons.every((button) => !button.hasAttribute("disabled"))).toBe(true);
  });
});

describe("resilience", () => {
  it("disables star animation under prefers-reduced-motion", () => {
    expect(builtCss()).toContain("prefers-reduced-motion");
  });
});

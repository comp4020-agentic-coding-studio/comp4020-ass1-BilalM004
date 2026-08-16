import { describe, expect, it } from "vitest";
import { builtCss, loadDoc } from "./helpers";

// Checks for story step 4/5 (split-screen time dilation simulator + reunion)
// against the built site. The live-updating numbers/formula themselves are
// exercised by spec/splitScreen.test.ts; these assert the shipped markup.
const doc = loadDoc("index.html");

describe("split screen", () => {
  it("is hidden by default", () => {
    const split = doc.querySelector('[data-screen="split"]');
    expect(split).toBeTruthy();
    expect(split?.hasAttribute("hidden")).toBe(true);
  });

  it("has exactly one selected rate button", () => {
    const pressed = doc.querySelectorAll('.split-rate-button[aria-pressed="true"]');
    expect(pressed).toHaveLength(1);
  });

  it("has a velocity slider with a non-empty accessible label", () => {
    const slider = doc.querySelector("#split-velocity-slider");
    expect(slider?.tagName).toBe("INPUT");
    const label = doc.querySelector('label[for="split-velocity-slider"]');
    expect(label?.textContent?.trim()).not.toBe("");
  });

  it("does not spam screen readers with the per-frame age counters or math sentence", () => {
    const earthAge = doc.querySelector("#split-earth-age");
    const shipAge = doc.querySelector("#split-ship-age");
    const formula = doc.querySelector("#split-formula");
    const mathSentence = doc.querySelector("#split-math-sentence");
    expect(earthAge?.getAttribute("aria-live")).not.toBe("polite");
    expect(shipAge?.getAttribute("aria-live")).not.toBe("polite");
    expect(formula?.getAttribute("aria-live")).toBe("off");
    expect(mathSentence?.getAttribute("aria-live")).toBe("off");
  });

  it("has a dedicated throttled announcer region", () => {
    const announcer = doc.querySelector("#split-announcer");
    expect(announcer?.getAttribute("aria-live")).toBe("polite");
  });

  it("shows the actual Lorentz formula, not just the plain-language sentence", () => {
    const formula = doc.querySelector("#split-formula");
    expect(formula?.textContent).toContain("γ");
    expect(formula?.textContent).toMatch(/1 − v²\/c²/);
  });

  it("has a reachable, labelled bring-them-home button", () => {
    const button = doc.querySelector("#split-bring-home-button");
    expect(button?.tagName).toBe("BUTTON");
    expect(button?.textContent?.trim()).not.toBe("");
  });

  it("has a reachable play/pause button, starting unpressed", () => {
    const button = doc.querySelector("#split-play-button");
    expect(button?.tagName).toBe("BUTTON");
    expect(button?.textContent?.trim()).not.toBe("");
    expect(button?.getAttribute("aria-pressed")).toBe("false");
  });

  it("explains the rate buttons in terms of real time the visitor spends watching", () => {
    const hint = doc.querySelector("#split-rate-hint");
    expect(hint?.textContent).toMatch(/real second/i);
    const group = doc.querySelector(".split-rate-buttons");
    expect(group?.getAttribute("aria-label")).toMatch(/real second/i);
    // The buttons themselves drop "second" entirely to stay short and save
    // room on mobile -- the hint, the group's aria-label, and each button's
    // own aria-label are what carry the "real time you spend watching"
    // framing for screen reader users.
    const buttons = doc.querySelectorAll(".split-rate-button");
    for (const button of buttons) {
      expect(button.getAttribute("aria-label")).toMatch(/second/i);
    }
  });

  it("defaults both twins to the young age stage with their existing markup intact", () => {
    const earthTwin = doc.querySelector("#split-earth-twin");
    const shipTwin = doc.querySelector("#split-ship-twin");
    expect(earthTwin?.getAttribute("data-age-stage")).toBe("young");
    expect(shipTwin?.getAttribute("data-age-stage")).toBe("young");
    expect(earthTwin?.querySelector(".twin-plain")).toBeTruthy();
    expect(shipTwin?.querySelector(".twin-suited")).toBeTruthy();
  });
});

describe("explanation screen", () => {
  it("is hidden by default", () => {
    const explain = doc.querySelector('[data-screen="explain"]');
    expect(explain).toBeTruthy();
    expect(explain?.hasAttribute("hidden")).toBe(true);
  });

  it("comes after both the split screen and the reunion in document order", () => {
    const screens = [...doc.querySelectorAll("[data-screen]")].map((el) => el.getAttribute("data-screen"));
    expect(screens.indexOf("explain")).toBeGreaterThan(screens.indexOf("split"));
    expect(screens.indexOf("explain")).toBeGreaterThan(screens.indexOf("reunion"));
  });

  it("has an accessible graph with a title and description", () => {
    const svg = doc.querySelector(".screen-explain svg");
    expect(svg?.getAttribute("role")).toBe("img");
    const titleId = svg?.getAttribute("aria-labelledby")?.split(" ")[0];
    const title = doc.getElementById(titleId ?? "");
    expect(title?.textContent?.trim()).not.toBe("");
  });

  it("has a control back to the comparison screen to try new values", () => {
    const explain = doc.querySelector('[data-screen="explain"]');
    const tryAgain = explain?.querySelector('[data-action="try-again"]');
    expect(tryAgain).toBeTruthy();
    expect(tryAgain?.textContent?.trim()).toBe("Try new values");
  });

  it("has a non-empty written explanation", () => {
    const text = doc.querySelector(".explain-text");
    expect(text?.textContent?.trim().length).toBeGreaterThan(40);
  });

  it("credits the real-world muon example to its source", () => {
    const credit = doc.querySelector(".explain-credit a");
    expect(credit?.getAttribute("href")).toBe("https://www.energy.gov/science/doe-explainsrelativity");
    expect(credit?.textContent?.trim().length).toBeGreaterThan(0);
  });
});

describe("reunion screen", () => {
  it("is hidden by default", () => {
    const reunion = doc.querySelector('[data-screen="reunion"]');
    expect(reunion).toBeTruthy();
    expect(reunion?.hasAttribute("hidden")).toBe(true);
  });

  it("states the exact no-return-trip line", () => {
    const reunion = doc.querySelector('[data-screen="reunion"]');
    expect(reunion?.textContent).toContain(
      "Teleported home instantly — no return trip, no extra time lost.",
    );
  });

  it("has a control back to the comparison screen to try new values", () => {
    const reunion = doc.querySelector('[data-screen="reunion"]');
    const tryAgain = reunion?.querySelector('[data-action="try-again"]');
    expect(tryAgain).toBeTruthy();
    expect(tryAgain?.textContent?.trim()).toBe("Try new values");
  });

  it("has a reachable, labelled button through to the explanation screen", () => {
    const button = doc.querySelector("#reunion-explain-button");
    expect(button?.tagName).toBe("BUTTON");
    expect(button?.textContent?.trim()).not.toBe("");
  });
});

describe("resilience", () => {
  it("ships the responsive split-grid breakpoint and reduced-motion styles", () => {
    const css = builtCss();
    expect(css).toContain("600px");
    expect(css).toContain("prefers-reduced-motion");
  });
});

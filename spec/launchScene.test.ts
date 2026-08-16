// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

// `three` is only ever reached via `await import("three")` inside
// launchScene.ts, never a static top-level import -- so forcing that
// dynamic import to fail surfaces as a normal rejected promise at the one
// place the app already expects loading could fail, instead of breaking
// module resolution for the whole page (see CLAUDE.md).
vi.mock("three", () => {
  throw new Error("simulated chunk-load failure");
});

const { startLaunchSequence, skipLaunchSequence } = await import("../src/scripts/launchScene");

// jsdom doesn't implement matchMedia -- launchScene.ts only reads `.matches`
// from it (to check prefers-reduced-motion), so a minimal stub is enough.
window.matchMedia = (query: string) =>
  ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }) as MediaQueryList;

// Must match FINAL_CAPTION in launchScene.ts -- that constant isn't
// exported, so this is asserted against by value.
const FINAL_CAPTION = "Farther still, into empty space";

function makeRefs() {
  return {
    ground: document.createElement("div"),
    canvas: document.createElement("canvas"),
    caption: document.createElement("p"),
    skipButton: document.createElement("button"),
  };
}

describe("launch sequence: space scene fails to load", () => {
  it("falls back to the final caption instead of leaving the ground scene stuck", async () => {
    const refs = makeRefs();

    startLaunchSequence(refs);
    skipLaunchSequence();

    await vi.waitFor(() => {
      expect(refs.caption.textContent).toBe(FINAL_CAPTION);
    });

    expect(refs.ground.hidden).toBe(true);
    expect(refs.skipButton.hidden).toBe(true);
  });

  it("does not get stuck replaying a dead rejected load on a second attempt", async () => {
    const refs = makeRefs();

    startLaunchSequence(refs);
    skipLaunchSequence();
    skipLaunchSequence();

    await vi.waitFor(() => {
      expect(refs.caption.textContent).toBe(FINAL_CAPTION);
    });
  });
});

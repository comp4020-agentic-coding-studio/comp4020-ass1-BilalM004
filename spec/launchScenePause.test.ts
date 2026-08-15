// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

const { startLaunchSequence } = await import("../src/scripts/launchScene");

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

function makeRefs() {
  const ground = document.createElement("div");
  const twinGo = document.createElement("div");
  twinGo.className = "launch-twin-go";
  const rocket = document.createElement("div");
  rocket.className = "launch-rocket";
  ground.append(twinGo, rocket);

  return {
    ground,
    canvas: document.createElement("canvas"),
    caption: document.createElement("p"),
    skipButton: document.createElement("button"),
  };
}

// jsdom's `document.hidden` is a fixed read-only getter (always `false`) --
// redefine it per call so the test can simulate the tab actually being
// backgrounded, the same way a real `visibilitychange` event would report it.
function setHidden(value: boolean): void {
  Object.defineProperty(document, "hidden", { value, configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("launch sequence: tab visibility", () => {
  it("freezes the ground-phase timers while the tab is hidden instead of letting them run on wall-clock time", async () => {
    const refs = makeRefs();
    const twinGo = refs.ground.querySelector(".launch-twin-go");
    const rocket = refs.ground.querySelector(".launch-rocket");

    startLaunchSequence(refs);

    // Boarding starts at GROUND_WALK_MS (2000ms) -- wait for it so we know
    // where in the timer chain we're hiding the tab.
    await vi.waitFor(() => expect(twinGo?.classList.contains("is-boarding")).toBe(true), { timeout: 3000 });

    setHidden(true);
    expect(refs.ground.classList.contains("is-paused")).toBe(true);

    // Liftoff is due 1000ms after boarding starts (GROUND_BOARD_MS). If the
    // timers weren't pausable, this alone would be more than enough time for
    // it to fire while hidden.
    await wait(1500);
    expect(rocket?.classList.contains("is-lifting")).toBe(false);

    setHidden(false);
    expect(refs.ground.classList.contains("is-paused")).toBe(false);

    // Only the leftover ~1000ms from before hiding should be needed now.
    await vi.waitFor(() => expect(rocket?.classList.contains("is-lifting")).toBe(true), { timeout: 3000 });
  });

  it(
    "does not re-fire a ground timer that already completed before a later hide/reveal cycle",
    async () => {
      const refs = makeRefs();
      const rocket = refs.ground.querySelector(".launch-rocket") as HTMLElement;
      const addSpy = vi.spyOn(rocket.classList, "add");

      startLaunchSequence(refs);

      // Let the liftoff timer (due at GROUND_WALK_MS + GROUND_BOARD_MS = 3000ms)
      // fire naturally, so by the time we hide the tab its handle is already
      // null because it *completed* -- not because anything paused it.
      await vi.waitFor(() => expect(rocket.classList.contains("is-lifting")).toBe(true), { timeout: 4000 });
      expect(addSpy.mock.calls.filter(([className]) => className === "is-lifting")).toHaveLength(1);

      // A hide/reveal well after that timer already fired must not resurrect
      // it: resumeGroundTimers previously re-armed *any* timer with a null
      // handle, unable to tell "already fired" apart from "paused". A buggy
      // re-arm uses the timer's untouched original delay (it was never
      // paused while running, so `remaining` was never decremented), so it
      // refires a full ~3000ms after resume rather than immediately -- wait
      // past that window before asserting it stayed at one call.
      setHidden(true);
      await wait(50);
      setHidden(false);
      await wait(3500);

      expect(addSpy.mock.calls.filter(([className]) => className === "is-lifting")).toHaveLength(1);
    },
    8000,
  );
});

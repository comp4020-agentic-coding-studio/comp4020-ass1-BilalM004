// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

const { startSplitScreen, bringTwinsHome, stopSplitScreen, toggleSplitScreenPlayback } = await import(
  "../src/scripts/splitScreen"
);

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
  const screen = document.createElement("section");
  const earthPane = document.createElement("div");
  const shipPane = document.createElement("div");
  const earthAge = document.createElement("p");
  const shipAge = document.createElement("p");
  const earthAgeTag = document.createElement("p");
  const shipAgeTag = document.createElement("p");
  const earthTwin = document.createElement("figure");
  const shipTwin = document.createElement("figure");
  const formula = document.createElement("p");
  const mathSentence = document.createElement("p");
  const announcer = document.createElement("p");
  const slider = document.createElement("input");
  slider.type = "range";
  slider.min = "0";
  slider.max = "9999";
  slider.value = "0";
  const rateButtons = [1, 10, 100].map((rate, index) => {
    const button = document.createElement("button");
    button.dataset.rate = String(rate);
    button.setAttribute("aria-pressed", index === 0 ? "true" : "false");
    return button;
  });
  const playButton = document.createElement("button");
  const bringHomeButton = document.createElement("button");
  const starStreak = document.createElement("div");
  const flash = document.createElement("div");
  screen.append(
    earthPane,
    shipPane,
    earthAge,
    shipAge,
    earthAgeTag,
    shipAgeTag,
    earthTwin,
    shipTwin,
    formula,
    mathSentence,
    announcer,
    slider,
    ...rateButtons,
    playButton,
    bringHomeButton,
    starStreak,
    flash,
  );

  return {
    screen,
    earthPane,
    shipPane,
    earthAge,
    shipAge,
    earthAgeTag,
    shipAgeTag,
    earthTwin,
    shipTwin,
    formula,
    mathSentence,
    announcer,
    slider,
    rateButtons,
    playButton,
    bringHomeButton,
    starStreak,
    flash,
  };
}

function setHidden(value: boolean): void {
  Object.defineProperty(document, "hidden", { value, configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("split screen: ageing", () => {
  it("ages the ship slower than Earth once velocity is above zero", async () => {
    const refs = makeRefs();
    startSplitScreen(refs);
    refs.slider.value = "9900"; // v = 0.99c
    refs.slider.dispatchEvent(new Event("input"));
    refs.rateButtons[2].dispatchEvent(new Event("click")); // 100 years/sec
    toggleSplitScreenPlayback();

    await wait(300);
    stopSplitScreen();

    const earthYears = Number(refs.earthAge.textContent?.match(/[\d.]+/)?.[0]);
    const shipYears = Number(refs.shipAge.textContent?.match(/[\d.]+/)?.[0]);
    expect(earthYears).toBeGreaterThan(0);
    expect(shipYears).toBeGreaterThan(0);
    expect(shipYears).toBeLessThan(earthYears);
  });

  it("updates the visible formula and math sentence as the slider moves", () => {
    const refs = makeRefs();
    startSplitScreen(refs);

    expect(refs.formula.textContent).toContain("γ");
    expect(refs.formula.textContent).toContain("0.0000");

    refs.slider.value = "9900";
    refs.slider.dispatchEvent(new Event("input"));

    expect(refs.formula.textContent).toContain("0.9900");
    expect(refs.mathSentence.textContent).toMatch(/years on Earth/);

    stopSplitScreen();
  });

  it("highlights the bring-them-home button once years start passing", async () => {
    const refs = makeRefs();
    startSplitScreen(refs);

    expect(refs.bringHomeButton.classList.contains("is-ready")).toBe(false);

    refs.slider.value = "9900";
    refs.slider.dispatchEvent(new Event("input"));
    refs.rateButtons[2].dispatchEvent(new Event("click")); // 100 years/sec
    toggleSplitScreenPlayback();

    await wait(100);

    expect(refs.bringHomeButton.classList.contains("is-ready")).toBe(true);

    stopSplitScreen();
  });
});

describe("split screen: tab visibility", () => {
  it("freezes ageing while the tab is hidden and resumes without a wall-clock jump", async () => {
    const refs = makeRefs();
    startSplitScreen(refs);
    refs.slider.value = "9900";
    refs.slider.dispatchEvent(new Event("input"));
    refs.rateButtons[2].dispatchEvent(new Event("click"));
    toggleSplitScreenPlayback();

    await wait(150);
    setHidden(true);
    expect(refs.screen.classList.contains("is-paused")).toBe(true);
    const earthYearsWhileHidden = refs.earthAge.textContent;

    await wait(300);
    expect(refs.earthAge.textContent).toBe(earthYearsWhileHidden);

    setHidden(false);
    expect(refs.screen.classList.contains("is-paused")).toBe(false);
    stopSplitScreen();
  });
});

describe("split screen: bring them home", () => {
  it("freezes the sim and calls onFinished exactly once with the final snapshot", async () => {
    const refs = makeRefs();
    const onFinished = vi.fn();
    startSplitScreen({ ...refs, onFinished });
    refs.slider.value = "9900";
    refs.slider.dispatchEvent(new Event("input"));
    toggleSplitScreenPlayback();

    await wait(100);
    bringTwinsHome();
    expect(refs.screen.classList.contains("is-flashing")).toBe(true);

    await vi.waitFor(() => expect(onFinished).toHaveBeenCalledTimes(1), { timeout: 2000 });
    const [result] = onFinished.mock.calls[0];
    expect(result.earthYears).toBeGreaterThan(0);
    expect(result.shipYears).toBeGreaterThan(0);
    expect(result.shipYears).toBeLessThan(result.earthYears);

    // Ageing must actually stop: waiting longer must not change the snapshot.
    const earthYearsAtHome = result.earthYears;
    await wait(200);
    const stillFrozen = Number(refs.earthAge.textContent?.match(/[\d.]+/)?.[0]);
    expect(stillFrozen).toBeCloseTo(earthYearsAtHome, 1);

    bringTwinsHome(); // must not double-fire
    await wait(200);
    expect(onFinished).toHaveBeenCalledTimes(1);

    stopSplitScreen();
  });
});

describe("split screen: play/pause", () => {
  it("starts paused so the slider and rate can be set before any years accrue", async () => {
    const refs = makeRefs();
    startSplitScreen(refs);

    expect(refs.screen.classList.contains("is-paused")).toBe(true);
    expect(refs.playButton.textContent).toBe("Play simulation");
    expect(refs.playButton.getAttribute("aria-pressed")).toBe("false");

    // Adjusting the slider before pressing play must not itself start ageing.
    refs.slider.value = "9900";
    refs.slider.dispatchEvent(new Event("input"));
    await wait(100);
    expect(refs.earthAge.textContent).toBe("Earth: 0.0 years");

    stopSplitScreen();
  });

  it("toggles playback on and off via toggleSplitScreenPlayback", async () => {
    const refs = makeRefs();
    startSplitScreen(refs);
    refs.rateButtons[2].dispatchEvent(new Event("click")); // 100 years/sec

    expect(toggleSplitScreenPlayback()).toBe(true);
    expect(refs.screen.classList.contains("is-paused")).toBe(false);
    expect(refs.playButton.textContent).toBe("Pause simulation");
    expect(refs.playButton.getAttribute("aria-pressed")).toBe("true");

    await wait(150);
    const earthYearsWhilePlaying = Number(refs.earthAge.textContent?.match(/[\d.]+/)?.[0]);
    expect(earthYearsWhilePlaying).toBeGreaterThan(0);

    expect(toggleSplitScreenPlayback()).toBe(false);
    expect(refs.screen.classList.contains("is-paused")).toBe(true);
    expect(refs.playButton.textContent).toBe("Play simulation");
    const frozenAt = refs.earthAge.textContent;
    await wait(150);
    expect(refs.earthAge.textContent).toBe(frozenAt);

    stopSplitScreen();
  });
});

describe("split screen: rate buttons", () => {
  it("acts as a single-select toggle group", () => {
    const refs = makeRefs();
    startSplitScreen(refs);

    refs.rateButtons[1].dispatchEvent(new Event("click"));
    const pressed = refs.rateButtons.filter((button) => button.getAttribute("aria-pressed") === "true");
    expect(pressed).toHaveLength(1);
    expect(pressed[0]).toBe(refs.rateButtons[1]);

    stopSplitScreen();
  });
});

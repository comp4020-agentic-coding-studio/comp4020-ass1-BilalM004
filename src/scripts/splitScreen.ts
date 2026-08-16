import {
  accumulateTick,
  ageStageForElapsedYears,
  clampVelocityFraction,
  describeLorentzFormula,
  describeTimeDilationRatio,
  type AgeStage,
} from "./physics";

export interface BringHomeResult {
  earthYears: number;
  shipYears: number;
  earthStage: AgeStage;
  shipStage: AgeStage;
}

export interface SplitScreenRefs {
  screen: HTMLElement;
  earthPane: HTMLElement;
  shipPane: HTMLElement;
  earthAge: HTMLElement;
  shipAge: HTMLElement;
  earthTwin: HTMLElement;
  shipTwin: HTMLElement;
  formula: HTMLElement;
  mathSentence: HTMLElement;
  announcer: HTMLElement;
  slider: HTMLInputElement;
  rateButtons: HTMLButtonElement[];
  playButton: HTMLButtonElement;
  bringHomeButton: HTMLButtonElement;
  starStreak: HTMLElement;
  flash: HTMLElement;
  onFinished?: (result: BringHomeResult) => void;
}

const ANNOUNCE_INTERVAL_MS = 4000;
const FLASH_FALLBACK_MS = 900;

interface ActiveSim {
  refs: SplitScreenRefs;
  raf: number | null;
  lastTs: number;
  velocity: number;
  yearsPerSecond: number;
  earthYears: number;
  shipYears: number;
  earthStage: AgeStage;
  shipStage: AgeStage;
  announceAccumMs: number;
  playing: boolean;
  bringingHome: boolean;
  pendingHomeFinish: (() => void) | null;
  cleanupFns: Array<() => void>;
}

let active: ActiveSim | null = null;

function formatYears(years: number): string {
  return years.toFixed(1);
}

function velocityFromSlider(slider: HTMLInputElement): number {
  return clampVelocityFraction(Number(slider.value) / 10000);
}

function updateSliderValueText(slider: HTMLInputElement, velocity: number): void {
  slider.setAttribute("aria-valuetext", `${(velocity * 100).toFixed(2)}% of the speed of light`);
}

function updateStreakSpeed(sim: ActiveSim): void {
  // Faster ship -> faster-looking streaks: map velocity [0, 1) to a duration
  // from 6s (near stationary) down to 0.4s (near light speed).
  const duration = Math.max(0.4, 6 - sim.velocity * 6);
  sim.refs.starStreak.style.setProperty("--streak-speed", `${duration.toFixed(2)}s`);
}

function applyStages(sim: ActiveSim): { earthChanged: boolean; shipChanged: boolean } {
  const earthStage = ageStageForElapsedYears(sim.earthYears);
  const shipStage = ageStageForElapsedYears(sim.shipYears);
  const earthChanged = earthStage !== sim.earthStage;
  const shipChanged = shipStage !== sim.shipStage;
  sim.earthStage = earthStage;
  sim.shipStage = shipStage;
  sim.refs.earthPane.dataset.ageStage = earthStage;
  sim.refs.shipPane.dataset.ageStage = shipStage;
  sim.refs.earthTwin.dataset.ageStage = earthStage;
  sim.refs.shipTwin.dataset.ageStage = shipStage;
  return { earthChanged, shipChanged };
}

function render(sim: ActiveSim): void {
  sim.refs.earthAge.textContent = `Earth: ${formatYears(sim.earthYears)} years`;
  sim.refs.shipAge.textContent = `Ship: ${formatYears(sim.shipYears)} years`;
  sim.refs.formula.textContent = describeLorentzFormula(sim.velocity);
  sim.refs.mathSentence.textContent = describeTimeDilationRatio(sim.velocity);
}

function announce(sim: ActiveSim, message: string): void {
  sim.refs.announcer.textContent = message;
  sim.announceAccumMs = 0;
}

function periodicAnnouncement(sim: ActiveSim): string {
  return `Earth has aged ${formatYears(sim.earthYears)} years. The ship has aged ${formatYears(sim.shipYears)} years.`;
}

// The screen is visually "paused" (freezing the star-streak/CSS animations,
// via the same `.is-paused` rule the tab-hidden case already uses) whenever
// ageing isn't actually happening, for either reason: the user hasn't
// pressed play (or paused), or the tab is hidden.
function syncPausedClass(sim: ActiveSim): void {
  sim.refs.screen.classList.toggle("is-paused", !sim.playing || document.hidden);
}

function updatePlayButton(sim: ActiveSim): void {
  sim.refs.playButton.textContent = sim.playing ? "Pause" : "Play";
  sim.refs.playButton.setAttribute("aria-pressed", String(sim.playing));
}

function tick(ts: number): void {
  const sim = active;
  if (!sim) return;
  if (sim.lastTs === 0) sim.lastTs = ts;
  const delta = Math.min(ts - sim.lastTs, 100);
  sim.lastTs = ts;

  const earthDtYears = sim.yearsPerSecond * (delta / 1000);
  const next = accumulateTick({ earthYears: sim.earthYears, shipYears: sim.shipYears }, earthDtYears, sim.velocity);
  sim.earthYears = next.earthYears;
  sim.shipYears = next.shipYears;

  const { earthChanged, shipChanged } = applyStages(sim);
  render(sim);

  sim.announceAccumMs += delta;
  if (earthChanged || shipChanged) {
    const parts: string[] = [];
    if (earthChanged) parts.push(`Earth twin is now ${sim.earthStage}.`);
    if (shipChanged) parts.push(`Ship twin is now ${sim.shipStage}.`);
    announce(sim, parts.join(" "));
  } else if (sim.announceAccumMs >= ANNOUNCE_INTERVAL_MS) {
    announce(sim, periodicAnnouncement(sim));
  }

  sim.raf = requestAnimationFrame(tick);
}

// Unlike the launch cutscene's rAF loop, this simulation's state (accrued
// years) is JS-driven, not just a render pose -- a browser that merely
// throttles (rather than fully suspends) a hidden tab's rAF would otherwise
// let years keep accruing in the background. So pause explicitly: cancel the
// rAF on hide and restart it (with a reset `lastTs`) on show, rather than
// relying on the browser to suspend it for us.
document.addEventListener("visibilitychange", () => {
  if (!active) return;
  if (document.hidden) {
    if (active.raf !== null) {
      cancelAnimationFrame(active.raf);
      active.raf = null;
    }
  } else {
    active.lastTs = 0;
    if (active.raf === null && active.playing && !active.bringingHome) {
      active.raf = requestAnimationFrame(tick);
    }
    active.pendingHomeFinish?.();
  }
  syncPausedClass(active);
});

export function startSplitScreen(refs: SplitScreenRefs): void {
  if (active) stopSplitScreen();

  // Reset the slider's DOM value *before* reading it into the new sim's
  // state -- otherwise a value left over from a previous run (the element is
  // reused across restarts) would leak in as the starting velocity even
  // though the slider visibly shows 0.
  refs.slider.value = "0";

  const sim: ActiveSim = {
    refs,
    raf: null,
    lastTs: 0,
    velocity: velocityFromSlider(refs.slider),
    yearsPerSecond: 1,
    earthYears: 0,
    shipYears: 0,
    earthStage: "young",
    shipStage: "young",
    announceAccumMs: 0,
    playing: false,
    bringingHome: false,
    pendingHomeFinish: null,
    cleanupFns: [],
  };
  active = sim;

  refs.screen.classList.remove("is-flashing");
  refs.announcer.textContent = "";
  updatePlayButton(sim);
  syncPausedClass(sim);
  // Reset the rate buttons' visible pressed state to match `yearsPerSecond`
  // above -- otherwise a previous run's selection (e.g. "100 years") would
  // still show pressed even though the new sim silently defaults to 1.
  for (const [index, button] of refs.rateButtons.entries()) {
    button.setAttribute("aria-pressed", index === 0 ? "true" : "false");
  }
  applyStages(sim);
  render(sim);
  updateSliderValueText(refs.slider, sim.velocity);
  updateStreakSpeed(sim);

  const onSliderInput = (): void => {
    if (active !== sim) return;
    sim.velocity = velocityFromSlider(refs.slider);
    updateSliderValueText(refs.slider, sim.velocity);
    render(sim);
    updateStreakSpeed(sim);
  };
  refs.slider.addEventListener("input", onSliderInput);
  sim.cleanupFns.push(() => refs.slider.removeEventListener("input", onSliderInput));

  for (const button of refs.rateButtons) {
    const onClick = (): void => {
      if (active !== sim) return;
      const rate = Number(button.dataset.rate ?? "1");
      sim.yearsPerSecond = rate;
      for (const other of refs.rateButtons) {
        other.setAttribute("aria-pressed", other === button ? "true" : "false");
      }
    };
    button.addEventListener("click", onClick);
    sim.cleanupFns.push(() => button.removeEventListener("click", onClick));
  }

  const onPlayClick = (): void => {
    if (active !== sim) return;
    toggleSplitScreenPlayback();
  };
  refs.playButton.addEventListener("click", onPlayClick);
  sim.cleanupFns.push(() => refs.playButton.removeEventListener("click", onPlayClick));

  // Starts paused: the slider and rate buttons above are already live, so
  // the visitor can set up a speed/velocity before any years accrue, rather
  // than ageing starting the instant the screen appears.
}

// Toggles between playing and paused. Returns the resulting playing state
// (true = now playing), or null if there's no active sim to toggle -- the
// slider/rate buttons stay adjustable in both states.
export function toggleSplitScreenPlayback(): boolean | null {
  const sim = active;
  if (!sim || sim.bringingHome) return null;

  sim.playing = !sim.playing;
  if (sim.playing) {
    if (sim.raf === null && !document.hidden) {
      sim.lastTs = 0;
      sim.raf = requestAnimationFrame(tick);
    }
  } else if (sim.raf !== null) {
    cancelAnimationFrame(sim.raf);
    sim.raf = null;
  }
  updatePlayButton(sim);
  syncPausedClass(sim);
  return sim.playing;
}

export function bringTwinsHome(): void {
  const sim = active;
  if (!sim || sim.bringingHome) return;
  sim.bringingHome = true;
  if (sim.raf !== null) cancelAnimationFrame(sim.raf);
  sim.raf = null;

  const result: BringHomeResult = {
    earthYears: sim.earthYears,
    shipYears: sim.shipYears,
    earthStage: sim.earthStage,
    shipStage: sim.shipStage,
  };

  let settled = false;
  const onTransitionEnd = (event: TransitionEvent): void => {
    if (event.target !== sim.refs.flash) return;
    finish();
  };
  const finish = (): void => {
    if (settled) return;
    settled = true;
    sim.pendingHomeFinish = null;
    sim.refs.flash.removeEventListener("transitionend", onTransitionEnd);
    sim.refs.onFinished?.(result);
  };

  sim.pendingHomeFinish = finish;
  sim.refs.flash.addEventListener("transitionend", onTransitionEnd);
  sim.refs.screen.classList.add("is-flashing");

  // If the tab is hidden when this fires, don't finish yet -- the
  // visibilitychange "shown" handler calls `pendingHomeFinish` instead, so
  // the handoff can't fire invisibly while backgrounded.
  window.setTimeout(() => {
    if (!document.hidden) finish();
  }, FLASH_FALLBACK_MS);
}

export function stopSplitScreen(): void {
  const sim = active;
  if (!sim) return;
  active = null;

  if (sim.raf !== null) cancelAnimationFrame(sim.raf);
  for (const cleanup of sim.cleanupFns) cleanup();
  sim.refs.screen.classList.remove("is-flashing", "is-paused");
}

import { renderExplainScreen } from "./explainScreen";
import { skipLaunchSequence, startLaunchSequence, stopLaunchSequence } from "./launchScene";
import { initMusicWidget } from "./musicWidget";
import { renderProgressRail, type StepId } from "./progressRail";
import { bringTwinsHome, startSplitScreen, stopSplitScreen, type BringHomeResult } from "./splitScreen";

const screens = document.querySelectorAll<HTMLElement>("[data-screen]");
const progressSteps = Array.from(document.querySelectorAll<HTMLElement>(".progress-step"));
const progressStepButtons = Array.from(document.querySelectorAll<HTMLButtonElement>(".progress-step-button"));

const musicWidget = document.querySelector<HTMLElement>("#music-widget");
const musicToggle = document.querySelector<HTMLButtonElement>("#music-toggle");
const musicClose = document.querySelector<HTMLButtonElement>("#music-close");
const musicPanel = document.querySelector<HTMLElement>("#music-panel");
const musicIframe = document.querySelector<HTMLIFrameElement>("#music-iframe");
if (musicWidget && musicToggle && musicClose && musicPanel && musicIframe) {
  initMusicWidget({
    widget: musicWidget,
    toggleButton: musicToggle,
    closeButton: musicClose,
    panel: musicPanel,
    iframe: musicIframe,
  });
}

function showScreen(name: string): void {
  let target: HTMLElement | null = null;
  for (const screen of screens) {
    const isTarget = screen.dataset.screen === name;
    screen.hidden = !isTarget;
    if (isTarget) target = screen;
  }
  target?.querySelector<HTMLElement>("h1, h2")?.focus();
  renderProgressRail(progressSteps, name);
}

document.querySelector("#start-button")?.addEventListener("click", () => {
  showScreen("intro");
});

document.querySelector("#choice-button")?.addEventListener("click", () => {
  showScreen("choice");
});

// Set by handleSplitScreenFinished and read by the reunion screen's "why did
// this happen?" button -- the explanation screen needs the chosen velocity,
// which isn't part of the reunion DOM it's populating at that point.
let lastBringHomeResult: BringHomeResult | null = null;

function handleSplitScreenFinished(result: BringHomeResult): void {
  lastBringHomeResult = result;

  const earthTwin = document.querySelector<HTMLElement>("#reunion-earth-twin");
  const shipTwin = document.querySelector<HTMLElement>("#reunion-ship-twin");
  const ages = document.querySelector<HTMLElement>("#reunion-ages");
  if (earthTwin) earthTwin.dataset.ageStage = result.earthStage;
  if (shipTwin) shipTwin.dataset.ageStage = result.shipStage;
  if (ages) {
    ages.textContent = `Earth: ${result.earthYears.toFixed(1)} years — Ship: ${result.shipYears.toFixed(1)} years`;
  }

  showScreen("reunion");
}

// Starts (or restarts) the twin/velocity simulator directly, without the
// launch cutscene -- shared by the normal launch flow below and by jumping
// straight to the "compare" step from the progress rail. startSplitScreen
// itself is safe to call repeatedly (it tears down any previous run first),
// so this can just be re-invoked each time the visitor lands on this step.
function beginSplitScreen(): void {
  showScreen("split");

  const screen = document.querySelector<HTMLElement>("#screen-split");
  const earthPane = document.querySelector<HTMLElement>("#split-earth-pane");
  const shipPane = document.querySelector<HTMLElement>("#split-ship-pane");
  const earthAge = document.querySelector<HTMLElement>("#split-earth-age");
  const shipAge = document.querySelector<HTMLElement>("#split-ship-age");
  const earthTwin = document.querySelector<HTMLElement>("#split-earth-twin");
  const shipTwin = document.querySelector<HTMLElement>("#split-ship-twin");
  const formula = document.querySelector<HTMLElement>("#split-formula");
  const mathSentence = document.querySelector<HTMLElement>("#split-math-sentence");
  const announcer = document.querySelector<HTMLElement>("#split-announcer");
  const slider = document.querySelector<HTMLInputElement>("#split-velocity-slider");
  const rateButtons = Array.from(document.querySelectorAll<HTMLButtonElement>(".split-rate-button"));
  const playButton = document.querySelector<HTMLButtonElement>("#split-play-button");
  const bringHomeButton = document.querySelector<HTMLButtonElement>("#split-bring-home-button");
  const starStreak = document.querySelector<HTMLElement>("#split-star-streak");
  const flash = document.querySelector<HTMLElement>(".screen-split .split-flash");

  if (
    screen &&
    earthPane &&
    shipPane &&
    earthAge &&
    shipAge &&
    earthTwin &&
    shipTwin &&
    formula &&
    mathSentence &&
    announcer &&
    slider &&
    playButton &&
    bringHomeButton &&
    starStreak &&
    flash
  ) {
    startSplitScreen({
      screen,
      earthPane,
      shipPane,
      earthAge,
      shipAge,
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
      onFinished: handleSplitScreenFinished,
    });
  }
}

function goToExplainScreen(): void {
  // The rail lets the visitor jump here before ever running the simulator --
  // fall back to a resting (v=0) graph rather than refusing to show the screen.
  const velocity = lastBringHomeResult?.velocity ?? 0;

  const path = document.querySelector<SVGPathElement>("#explain-gamma-path");
  const point = document.querySelector<SVGCircleElement>("#explain-gamma-point");
  const caption = document.querySelector<HTMLElement>("#explain-gamma-caption");
  if (path && point && caption) {
    renderExplainScreen({ path, point, caption }, velocity);
  }

  showScreen("explain");
}

// Jumps to a stage of the story from the progress rail. Every step is
// clickable regardless of progress, so this can jump forward to a stage
// that has no simulator result yet -- beginSplitScreen/goToExplainScreen
// fall back to sensible defaults (v=0) rather than assuming one exists.
function goToStep(step: StepId): void {
  stopLaunchSequence();
  stopSplitScreen();

  switch (step) {
    case "start":
      showScreen("start");
      break;
    case "choice":
      showScreen("choice");
      break;
    case "compare":
      beginSplitScreen();
      break;
    case "reunion":
      showScreen("reunion");
      break;
    case "explain":
      goToExplainScreen();
      break;
  }
}

for (const button of progressStepButtons) {
  button.addEventListener("click", () => {
    const step = button.dataset.step as StepId;
    goToStep(step);
  });
}

document.querySelector("#reunion-explain-button")?.addEventListener("click", () => {
  goToExplainScreen();
});

document.querySelector("#special-relativity-button")?.addEventListener("click", () => {
  showScreen("launch");

  const ground = document.querySelector<HTMLElement>("#launch-ground");
  const canvas = document.querySelector<HTMLCanvasElement>("#launch-canvas");
  const caption = document.querySelector<HTMLElement>("#launch-caption");
  const skipButton = document.querySelector<HTMLButtonElement>("#launch-skip-button");
  if (ground && canvas && caption && skipButton) {
    startLaunchSequence({
      ground,
      canvas,
      caption,
      skipButton,
      onFinished: beginSplitScreen,
    });
  }
});

document.querySelector("#launch-skip-button")?.addEventListener("click", () => {
  skipLaunchSequence();
});

document.querySelector("#split-bring-home-button")?.addEventListener("click", () => {
  bringTwinsHome();
});

document.querySelectorAll<HTMLElement>('[data-action="restart"]').forEach((element) => {
  element.addEventListener("click", (event) => {
    event.preventDefault();
    goToStep("start");
  });
});

document.querySelectorAll<HTMLElement>('[data-action="try-again"]').forEach((element) => {
  element.addEventListener("click", (event) => {
    event.preventDefault();
    goToStep("compare");
  });
});

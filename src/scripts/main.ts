import { skipLaunchSequence, startLaunchSequence, stopLaunchSequence } from "./launchScene";
import { bringTwinsHome, startSplitScreen, stopSplitScreen, type BringHomeResult } from "./splitScreen";

const screens = document.querySelectorAll<HTMLElement>("[data-screen]");

function showScreen(name: string): void {
  let target: HTMLElement | null = null;
  for (const screen of screens) {
    const isTarget = screen.dataset.screen === name;
    screen.hidden = !isTarget;
    if (isTarget) target = screen;
  }
  target?.querySelector<HTMLElement>("h1, h2")?.focus();
}

document.querySelector("#start-button")?.addEventListener("click", () => {
  showScreen("intro");
});

document.querySelector("#choice-button")?.addEventListener("click", () => {
  showScreen("choice");
});

function handleSplitScreenFinished(result: BringHomeResult): void {
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
      onFinished: () => {
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
      },
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
    stopLaunchSequence();
    stopSplitScreen();
    showScreen("start");
  });
});

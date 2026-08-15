import { skipLaunchSequence, startLaunchSequence, stopLaunchSequence } from "./launchScene";

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

document.querySelector("#special-relativity-button")?.addEventListener("click", () => {
  showScreen("launch");

  const ground = document.querySelector<HTMLElement>("#launch-ground");
  const canvas = document.querySelector<HTMLCanvasElement>("#launch-canvas");
  const caption = document.querySelector<HTMLElement>("#launch-caption");
  const skipButton = document.querySelector<HTMLButtonElement>("#launch-skip-button");
  if (ground && canvas && caption && skipButton) {
    startLaunchSequence({ ground, canvas, caption, skipButton });
  }
});

document.querySelector("#launch-skip-button")?.addEventListener("click", () => {
  skipLaunchSequence();
});

document.querySelector('[data-action="restart"]')?.addEventListener("click", (event) => {
  event.preventDefault();
  stopLaunchSequence();
  showScreen("start");
});

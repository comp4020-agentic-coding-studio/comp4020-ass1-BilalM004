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

document.querySelector('[data-action="restart"]')?.addEventListener("click", (event) => {
  event.preventDefault();
  showScreen("start");
});

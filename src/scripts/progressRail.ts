// Drives the fixed left-hand story-progress rail. Pure step logic here, kept
// separate from the DOM writes, so the mapping/ordering can be unit tested
// without touching the page.

export const STEP_ORDER = ["start", "twins", "choice", "compare", "reunion", "explain"] as const;

export type StepId = (typeof STEP_ORDER)[number];

export type StepState = "done" | "current" | "upcoming";

// Every [data-screen] name the story can show, collapsed onto the six
// visible stages of the progress rail.
export const SCREEN_TO_STEP: Record<string, StepId> = {
  start: "start",
  intro: "twins",
  choice: "choice",
  launch: "compare",
  split: "compare",
  reunion: "reunion",
  explain: "explain",
};

export function stepStateFor(stepIndex: number, currentIndex: number): StepState {
  if (stepIndex < currentIndex) return "done";
  if (stepIndex === currentIndex) return "current";
  return "upcoming";
}

export function renderProgressRail(steps: HTMLElement[], screenName: string): void {
  const step = SCREEN_TO_STEP[screenName];
  if (!step) return;

  const currentIndex = STEP_ORDER.indexOf(step);

  steps.forEach((element) => {
    const index = STEP_ORDER.indexOf(element.dataset.step as StepId);
    const state = stepStateFor(index, currentIndex);
    element.dataset.state = state;

    // Every step is clickable, whether the visitor has reached it yet or
    // not -- the rail is a scrubber, not a gate.
    const button = element.querySelector<HTMLButtonElement>(".progress-step-button");
    if (button) {
      if (state === "current") {
        button.setAttribute("aria-current", "step");
      } else {
        button.removeAttribute("aria-current");
      }
    }
  });
}

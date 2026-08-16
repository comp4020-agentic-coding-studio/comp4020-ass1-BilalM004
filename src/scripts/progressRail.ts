// Drives the fixed left-hand story-progress rail. Pure step logic here, kept
// separate from the DOM writes, so the mapping/ordering can be unit tested
// without touching the page.

export const STEP_ORDER = ["start", "choice", "compare", "reunion", "explain"] as const;

export type StepId = (typeof STEP_ORDER)[number];

export type StepState = "done" | "current" | "upcoming";

// Every [data-screen] name the story can show, collapsed onto the five
// visible stages of the progress rail.
export const SCREEN_TO_STEP: Record<string, StepId> = {
  start: "start",
  intro: "start",
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

    // Only steps the visitor has already reached (done/current) are
    // clickable -- you can jump back, but not skip ahead.
    const button = element.querySelector<HTMLButtonElement>(".progress-step-button");
    if (button) {
      button.disabled = state === "upcoming";
      if (state === "current") {
        button.setAttribute("aria-current", "step");
      } else {
        button.removeAttribute("aria-current");
      }
    }
  });
}

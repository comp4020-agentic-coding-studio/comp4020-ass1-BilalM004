// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { renderProgressRail, SCREEN_TO_STEP, STEP_ORDER, stepStateFor } from "../src/scripts/progressRail";

describe("stepStateFor", () => {
  it("marks earlier steps done", () => {
    expect(stepStateFor(0, 2)).toBe("done");
    expect(stepStateFor(1, 2)).toBe("done");
  });

  it("marks the matching step current", () => {
    expect(stepStateFor(2, 2)).toBe("current");
  });

  it("marks later steps upcoming", () => {
    expect(stepStateFor(3, 2)).toBe("upcoming");
    expect(stepStateFor(4, 2)).toBe("upcoming");
  });
});

describe("SCREEN_TO_STEP", () => {
  it("covers every screen the story shows", () => {
    const screens = ["start", "intro", "choice", "launch", "split", "reunion", "explain"];
    for (const screen of screens) {
      expect(STEP_ORDER).toContain(SCREEN_TO_STEP[screen]);
    }
  });

  it("collapses the launch cutscene and the split simulator onto the same step", () => {
    expect(SCREEN_TO_STEP.launch).toBe(SCREEN_TO_STEP.split);
  });

  it("collapses start and intro onto the same step", () => {
    expect(SCREEN_TO_STEP.start).toBe(SCREEN_TO_STEP.intro);
  });
});

function makeSteps() {
  return STEP_ORDER.map((step) => {
    const element = document.createElement("li");
    element.dataset.step = step;

    const button = document.createElement("button");
    button.className = "progress-step-button";
    button.dataset.step = step;
    element.appendChild(button);

    return element;
  });
}

function buttonOf(step: HTMLElement) {
  return step.querySelector<HTMLButtonElement>(".progress-step-button")!;
}

describe("renderProgressRail", () => {
  it("marks exactly one step's button as aria-current, matching the shown screen", () => {
    const steps = makeSteps();
    renderProgressRail(steps, "split");

    const current = steps.filter((el) => buttonOf(el).getAttribute("aria-current") === "step");
    expect(current).toHaveLength(1);
    expect(current[0].dataset.step).toBe("compare");
  });

  it("marks steps before the current one done and steps after it upcoming", () => {
    const steps = makeSteps();
    renderProgressRail(steps, "explain");

    expect(steps.map((el) => el.dataset.state)).toEqual(["done", "done", "done", "done", "current"]);
  });

  it("only enables buttons for reached steps (done or current), not upcoming ones", () => {
    const steps = makeSteps();
    renderProgressRail(steps, "split");

    expect(steps.map((el) => buttonOf(el).disabled)).toEqual([false, false, false, true, true]);
  });

  it("does nothing for an unknown screen name", () => {
    const steps = makeSteps();
    renderProgressRail(steps, "not-a-real-screen");

    expect(steps.every((el) => el.dataset.state === undefined)).toBe(true);
  });
});

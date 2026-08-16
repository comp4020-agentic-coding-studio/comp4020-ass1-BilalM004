// Draws the explanation screen's gamma-vs-speed graph and caption. No
// randomness/timers here -- it's a pure function of the velocity the visitor
// chose on the split screen, so it can just be re-run each time that screen
// is shown.
import { clampVelocityFraction, describeTimeDilationRatio, gammaCurvePoints, lorentzFactor, MAX_VELOCITY_FRACTION } from "./physics";

export interface ExplainScreenRefs {
  path: SVGPathElement;
  point: SVGCircleElement;
  caption: HTMLElement;
}

// Graph area within the `viewBox="0 0 320 200"` in index.astro -- kept in
// sync with the axis line/label coordinates hardcoded there.
const GRAPH_X_MIN = 40;
const GRAPH_X_MAX = 300;
const GRAPH_Y_TOP = 10;
const GRAPH_Y_BOTTOM = 170;

const GAMMA_MAX = lorentzFactor(MAX_VELOCITY_FRACTION);

function xForVelocity(v: number): number {
  return GRAPH_X_MIN + (v / MAX_VELOCITY_FRACTION) * (GRAPH_X_MAX - GRAPH_X_MIN);
}

function yForGamma(gamma: number): number {
  const fraction = (gamma - 1) / (GAMMA_MAX - 1);
  return GRAPH_Y_BOTTOM - fraction * (GRAPH_Y_BOTTOM - GRAPH_Y_TOP);
}

function buildCurvePath(): string {
  return gammaCurvePoints()
    .map((point, index) => {
      const command = index === 0 ? "M" : "L";
      return `${command} ${xForVelocity(point.v).toFixed(2)},${yForGamma(point.gamma).toFixed(2)}`;
    })
    .join(" ");
}

export function renderExplainScreen(refs: ExplainScreenRefs, velocity: number): void {
  const clamped = clampVelocityFraction(velocity);
  refs.path.setAttribute("d", buildCurvePath());
  refs.point.setAttribute("cx", xForVelocity(clamped).toFixed(2));
  refs.point.setAttribute("cy", yForGamma(lorentzFactor(clamped)).toFixed(2));
  refs.caption.textContent = describeTimeDilationRatio(clamped);
}

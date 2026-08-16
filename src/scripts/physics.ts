// Pure special-relativity math for the split-screen twin simulation. No DOM.
//
// Earth is treated as a single valid inertial frame for the whole run: the
// story's reunion is an instant teleport with "no return trip", so the usual
// twin-paradox turnaround/frame-swap subtlety never comes up here.

export const MAX_VELOCITY_FRACTION = 0.9999;

export function clampVelocityFraction(v: number): number {
  if (Number.isNaN(v)) return 0;
  return Math.min(Math.max(v, 0), MAX_VELOCITY_FRACTION);
}

export function lorentzFactor(v: number): number {
  const clamped = clampVelocityFraction(v);
  return 1 / Math.sqrt(1 - clamped * clamped);
}

export function shipYearsForEarthYears(earthDtYears: number, v: number): number {
  return earthDtYears / lorentzFactor(v);
}

export type AgeStage = "young" | "middle" | "old";

export const AGE_STAGE_THRESHOLD_YEARS = { middle: 15, old: 40 };

export function ageStageForElapsedYears(elapsedYears: number): AgeStage {
  if (elapsedYears >= AGE_STAGE_THRESHOLD_YEARS.old) return "old";
  if (elapsedYears >= AGE_STAGE_THRESHOLD_YEARS.middle) return "middle";
  return "young";
}

export interface AgeState {
  earthYears: number;
  shipYears: number;
}

// Returns a NEW state -- never mutates `state` -- and only ever converts the
// one `earthDtYears` slice passed in using the velocity active *during* that
// slice. A velocity change on the next call therefore only changes future
// accumulation; it can never retroactively rewrite years already accrued.
export function accumulateTick(state: AgeState, earthDtYears: number, v: number): AgeState {
  return {
    earthYears: state.earthYears + earthDtYears,
    shipYears: state.shipYears + shipYearsForEarthYears(earthDtYears, v),
  };
}

function formatGamma(gamma: number): string {
  return gamma.toFixed(gamma < 10 ? 2 : 1);
}

export function describeTimeDilationRatio(v: number): string {
  const gamma = lorentzFactor(v);
  if (gamma < 1.01) return "Earth and the ship are ageing at almost the same rate.";
  return `For every ${formatGamma(gamma)} years on Earth, only 1 year passes on the ship.`;
}

export interface LorentzFormulaParts {
  velocity: string;
  gamma: string;
}

// Split out so the DOM layer can wrap the ship-speed figures in their own
// highlight span without this module (deliberately no-DOM) knowing about markup.
export function describeLorentzFormulaParts(v: number): LorentzFormulaParts {
  const clamped = clampVelocityFraction(v);
  return { velocity: clamped.toFixed(4), gamma: formatGamma(lorentzFactor(clamped)) };
}

export function describeLorentzFormula(v: number): string {
  const { velocity, gamma } = describeLorentzFormulaParts(v);
  return `γ = 1 / √(1 − v²/c²) = 1 / √(1 − ${velocity}²) = ${gamma}`;
}

export interface GammaCurvePoint {
  v: number;
  gamma: number;
}

// Evenly-sampled points along the gamma curve from v=0 to the velocity cap,
// for drawing the explanation screen's graph. Pure/no DOM, like the rest of
// this file, so the graph-drawing code just maps these to screen coordinates.
export function gammaCurvePoints(steps = 60): GammaCurvePoint[] {
  const points: GammaCurvePoint[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const v = (i / steps) * MAX_VELOCITY_FRACTION;
    points.push({ v, gamma: lorentzFactor(v) });
  }
  return points;
}

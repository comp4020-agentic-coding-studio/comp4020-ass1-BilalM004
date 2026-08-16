import { describe, expect, it } from "vitest";
import {
  accumulateTick,
  ageStageForElapsedYears,
  AGE_STAGE_THRESHOLD_YEARS,
  describeLorentzFormula,
  describeTimeDilationRatio,
  lorentzFactor,
  MAX_VELOCITY_FRACTION,
} from "../src/scripts/physics";

describe("lorentzFactor", () => {
  it("is 1 at zero velocity (no dilation)", () => {
    expect(lorentzFactor(0)).toBe(1);
  });

  it("spot-checks against the known 0.99c value from CLAUDE.md", () => {
    expect(lorentzFactor(0.99)).toBeCloseTo(7.09, 2);
  });

  it("spot-checks the 0.9999c value from CLAUDE.md", () => {
    expect(lorentzFactor(0.9999)).toBeCloseTo(70.7, 1);
  });

  it("clamps above the cap instead of returning Infinity/NaN", () => {
    expect(lorentzFactor(1)).toBe(lorentzFactor(MAX_VELOCITY_FRACTION));
    expect(lorentzFactor(1.5)).toBe(lorentzFactor(MAX_VELOCITY_FRACTION));
    expect(Number.isFinite(lorentzFactor(1.5))).toBe(true);
  });

  it("clamps below zero", () => {
    expect(lorentzFactor(-1)).toBe(1);
  });

  it("is monotonically increasing in v", () => {
    const samples = [0, 0.2, 0.5, 0.8, 0.9, 0.99, 0.999, 0.9999];
    for (let i = 1; i < samples.length; i += 1) {
      expect(lorentzFactor(samples[i])).toBeGreaterThan(lorentzFactor(samples[i - 1]));
    }
  });
});

describe("accumulateTick", () => {
  it("does not mutate the state passed in", () => {
    const state = { earthYears: 0, shipYears: 0 };
    accumulateTick(state, 5, 0.5);
    expect(state).toEqual({ earthYears: 0, shipYears: 0 });
  });

  it("accrues ship time slower than Earth time once velocity is above zero", () => {
    const state0 = { earthYears: 0, shipYears: 0 };
    const state1 = accumulateTick(state0, 5, 0.99);
    expect(state1.earthYears).toBe(5);
    expect(state1.shipYears).toBeCloseTo(5 / lorentzFactor(0.99), 6);
    expect(state1.shipYears).toBeLessThan(state1.earthYears);
  });

  it("a later velocity change never rewrites years already accrued at a different velocity", () => {
    const state0 = { earthYears: 0, shipYears: 0 };
    const state1 = accumulateTick(state0, 5, 0); // no dilation for this slice
    expect(state1.shipYears).toBe(5);

    const state2 = accumulateTick(state1, 5, 0.99); // velocity ramps up for the next slice
    // state1 itself is untouched (accumulateTick never mutates its input)...
    expect(state1.shipYears).toBe(5);
    // ...and state2's total only reflects each slice's own velocity, not a
    // single gamma applied retroactively across the whole elapsed time.
    expect(state2.earthYears).toBe(10);
    expect(state2.shipYears).toBeCloseTo(5 + 5 / lorentzFactor(0.99), 6);
  });
});

describe("ageStageForElapsedYears", () => {
  it("is young at 0 and just under the middle threshold", () => {
    expect(ageStageForElapsedYears(0)).toBe("young");
    expect(ageStageForElapsedYears(AGE_STAGE_THRESHOLD_YEARS.middle - 0.01)).toBe("young");
  });

  it("is middle exactly at the middle threshold and just under old", () => {
    expect(ageStageForElapsedYears(AGE_STAGE_THRESHOLD_YEARS.middle)).toBe("middle");
    expect(ageStageForElapsedYears(AGE_STAGE_THRESHOLD_YEARS.old - 0.01)).toBe("middle");
  });

  it("is old at and beyond the old threshold, including very large values", () => {
    expect(ageStageForElapsedYears(AGE_STAGE_THRESHOLD_YEARS.old)).toBe("old");
    expect(ageStageForElapsedYears(10_000)).toBe("old");
  });
});

describe("describeTimeDilationRatio", () => {
  it("does not claim a large ratio at zero velocity", () => {
    expect(describeTimeDilationRatio(0)).not.toMatch(/\d/);
  });

  it("embeds a ratio consistent with lorentzFactor at 0.99c", () => {
    const sentence = describeTimeDilationRatio(0.99);
    const match = sentence.match(/([\d.]+) years on Earth/);
    expect(match).toBeTruthy();
    expect(Number(match?.[1])).toBeCloseTo(lorentzFactor(0.99), 1);
  });
});

describe("describeLorentzFormula", () => {
  it("embeds both the substituted velocity and the resulting gamma", () => {
    const formula = describeLorentzFormula(0.99);
    expect(formula).toContain("0.9900");
    const gammaMatch = formula.match(/=\s*([\d.]+)\s*$/);
    expect(gammaMatch).toBeTruthy();
    expect(Number(gammaMatch?.[1])).toBeCloseTo(lorentzFactor(0.99), 1);
  });

  it("clamps the substituted velocity to the cap", () => {
    const formula = describeLorentzFormula(1.5);
    expect(formula).toContain(MAX_VELOCITY_FRACTION.toFixed(4));
  });
});

// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { renderExplainScreen } from "../src/scripts/explainScreen";
import { describeTimeDilationRatio, lorentzFactor } from "../src/scripts/physics";

const SVG_NS = "http://www.w3.org/2000/svg";

function makeRefs() {
  const path = document.createElementNS(SVG_NS, "path") as SVGPathElement;
  const point = document.createElementNS(SVG_NS, "circle") as SVGCircleElement;
  const caption = document.createElement("figcaption");
  return { path, point, caption };
}

describe("renderExplainScreen", () => {
  it("draws a non-empty curve path", () => {
    const refs = makeRefs();
    renderExplainScreen(refs, 0.5);
    expect(refs.path.getAttribute("d")).toMatch(/^M .+ L .+/);
  });

  it("places the marker further right and higher for a faster chosen velocity", () => {
    const refsSlow = makeRefs();
    const refsFast = makeRefs();
    renderExplainScreen(refsSlow, 0.1);
    renderExplainScreen(refsFast, 0.99);

    expect(Number(refsFast.point.getAttribute("cx"))).toBeGreaterThan(Number(refsSlow.point.getAttribute("cx")));
    // SVG y grows downward, so a bigger gamma means a smaller cy.
    expect(Number(refsFast.point.getAttribute("cy"))).toBeLessThan(Number(refsSlow.point.getAttribute("cy")));
  });

  it("puts the marker at the origin for zero velocity", () => {
    const refs = makeRefs();
    renderExplainScreen(refs, 0);
    expect(Number(refs.point.getAttribute("cx"))).toBeCloseTo(40, 1);
    expect(Number(refs.point.getAttribute("cy"))).toBeCloseTo(170, 1);
  });

  it("sets the caption to the same ratio sentence the split screen uses", () => {
    const refs = makeRefs();
    renderExplainScreen(refs, 0.99);
    expect(refs.caption.textContent).toBe(describeTimeDilationRatio(0.99));
    expect(refs.caption.textContent).toContain(lorentzFactor(0.99).toFixed(2));
  });

  it("clamps an out-of-range velocity instead of breaking", () => {
    const refs = makeRefs();
    renderExplainScreen(refs, 5);
    expect(refs.path.getAttribute("d")).toMatch(/^M .+ L .+/);
    expect(Number(refs.point.getAttribute("cx"))).toBeCloseTo(300, 1);
  });
});

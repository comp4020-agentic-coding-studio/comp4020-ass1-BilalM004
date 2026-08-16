// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

const { buildMusicEmbedSrc, initMusicWidget } = await import("../src/scripts/musicWidget");

function makeRefs() {
  const widget = document.createElement("div");
  const toggleButton = document.createElement("button");
  toggleButton.setAttribute("aria-expanded", "false");
  const panel = document.createElement("div");
  panel.hidden = true;
  const closeButton = document.createElement("button");
  const iframe = document.createElement("iframe");
  panel.append(closeButton, iframe);
  widget.append(toggleButton, panel);
  return { widget, toggleButton, closeButton, panel, iframe };
}

describe("music widget", () => {
  it("starts collapsed with the embed not yet loaded", () => {
    const refs = makeRefs();
    initMusicWidget(refs);

    expect(refs.panel.hidden).toBe(true);
    expect(refs.toggleButton.getAttribute("aria-expanded")).toBe("false");
    expect(refs.iframe.getAttribute("src")).toBeNull();
  });

  it("expands and lazily loads a looping YouTube embed on first toggle click", () => {
    const refs = makeRefs();
    initMusicWidget(refs);

    refs.toggleButton.dispatchEvent(new Event("click"));

    expect(refs.panel.hidden).toBe(false);
    expect(refs.toggleButton.getAttribute("aria-expanded")).toBe("true");
    const src = refs.iframe.getAttribute("src");
    expect(src).toContain("youtube.com/embed/");
    expect(src).toContain("loop=1");
    expect(src).toContain("playlist=");
    expect(src).not.toContain("autoplay");
  });

  it("collapses on a second toggle click without reloading the embed", () => {
    const refs = makeRefs();
    initMusicWidget(refs);

    refs.toggleButton.dispatchEvent(new Event("click"));
    const srcAfterExpand = refs.iframe.getAttribute("src");
    refs.toggleButton.dispatchEvent(new Event("click"));

    expect(refs.panel.hidden).toBe(true);
    expect(refs.toggleButton.getAttribute("aria-expanded")).toBe("false");
    expect(refs.iframe.getAttribute("src")).toBe(srcAfterExpand);
  });

  it("collapses via the dedicated close button", () => {
    const refs = makeRefs();
    initMusicWidget(refs);

    refs.toggleButton.dispatchEvent(new Event("click"));
    refs.closeButton.dispatchEvent(new Event("click"));

    expect(refs.panel.hidden).toBe(true);
    expect(refs.toggleButton.getAttribute("aria-expanded")).toBe("false");
  });
});

describe("music widget: embed URL", () => {
  it("builds a single-video loop for the given video id", () => {
    const src = buildMusicEmbedSrc("abc123");

    expect(src).toBe(
      "https://www.youtube.com/embed/abc123?enablejsapi=1&loop=1&playlist=abc123&modestbranding=1&rel=0",
    );
  });
});

// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

// A real <canvas> can only ever hand out one live WebGL context for its
// whole lifetime -- once a renderer built from it is disposed
// (`forceContextLoss()`), a second `new THREE.WebGLRenderer({ canvas })` on
// that *same* node throws instead of getting a fresh context. This fake
// reproduces exactly that failure mode (throw on a canvas it has already
// seen) while auto-stubbing every other THREE export as an inert,
// infinitely-chainable no-op, so buildScene() can run to completion without
// a real WebGL/GPU environment.
vi.mock("three", () => {
  const usedCanvases = new Set<HTMLCanvasElement>();

  function makeAutoMock(): unknown {
    const fn: unknown = new Proxy(function AutoMock() {}, {
      get(_target, prop) {
        if (prop === "then") return undefined;
        return fn;
      },
      apply() {
        return fn;
      },
      construct() {
        return fn as object;
      },
    });
    return fn;
  }

  class FakeWebGLRenderer {
    domElement = makeAutoMock();
    constructor({ canvas }: { canvas: HTMLCanvasElement }) {
      if (usedCanvases.has(canvas)) {
        throw new TypeError("Cannot read properties of null (reading 'precision')");
      }
      usedCanvases.add(canvas);
    }
    setPixelRatio(): void {}
    setSize(): void {}
    dispose(): void {}
    forceContextLoss(): void {}
    render(): void {}
  }

  // renderPose()'s heading/rotation math does real arithmetic on
  // THREE.Vector3 instances (lengthSq() feeds a numeric comparison), which an
  // inert auto-mock object can't satisfy -- give it a minimal real
  // implementation instead of stubbing it out too.
  class MiniVector3 {
    x: number;
    y: number;
    z: number;
    constructor(x = 0, y = 0, z = 0) {
      this.x = x;
      this.y = y;
      this.z = z;
    }
    set(x: number, y: number, z: number): this {
      this.x = x;
      this.y = y;
      this.z = z;
      return this;
    }
    lengthSq(): number {
      return this.x * this.x + this.y * this.y + this.z * this.z;
    }
    normalize(): this {
      const len = Math.sqrt(this.lengthSq()) || 1;
      this.x /= len;
      this.y /= len;
      this.z /= len;
      return this;
    }
  }

  const auto = makeAutoMock();
  // vitest/Vite copy the mock factory's return value into a real ES module
  // namespace object (which enumerates its own keys) rather than reading
  // through a Proxy's `get` trap on demand, so every named export buildScene()
  // touches must exist as a real property up front -- a fallback `get` trap
  // alone silently resolves to `undefined` for all of these.
  const namedExports = [
    "AdditiveBlending",
    "AmbientLight",
    "BackSide",
    "BoxGeometry",
    "BufferAttribute",
    "BufferGeometry",
    "ConeGeometry",
    "CylinderGeometry",
    "DoubleSide",
    "Group",
    "Mesh",
    "MeshBasicMaterial",
    "MeshStandardMaterial",
    "PerspectiveCamera",
    "PlaneGeometry",
    "PointLight",
    "Points",
    "PointsMaterial",
    "Scene",
    "SphereGeometry",
    "Sprite",
    "SpriteMaterial",
    "SRGBColorSpace",
    "ACESFilmicToneMapping",
    "TextureLoader",
  ];
  const namespace: Record<string, unknown> = { WebGLRenderer: FakeWebGLRenderer, Vector3: MiniVector3 };
  for (const name of namedExports) namespace[name] = auto;
  return namespace;
});

// buildScene()'s procedural textures draw onto a real 2D canvas context,
// which jsdom doesn't implement without the optional `canvas` npm package --
// irrelevant to the WebGL-context-reuse bug under test, so stub them out
// rather than pull in a real canvas backend.
vi.mock("../src/scripts/proceduralTextures", () => ({
  makeDotTexture: () => ({}),
  makeGlowTexture: () => ({}),
  makeMetalTexture: () => ({}),
  makeRingTextureFromStrip: () => ({}),
}));

const { startLaunchSequence, skipLaunchSequence, stopLaunchSequence } = await import("../src/scripts/launchScene");

window.matchMedia = (query: string) =>
  ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }) as MediaQueryList;

const FINAL_CAPTION = "Into empty space";

function makeRefs() {
  return {
    ground: document.createElement("div"),
    canvas: document.createElement("canvas"),
    caption: document.createElement("p"),
    skipButton: document.createElement("button"),
  };
}

describe("launch sequence: restart reuses the same canvas element", () => {
  it("builds a working scene again on a second run after a restart", async () => {
    const refs = makeRefs();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    startLaunchSequence(refs);
    skipLaunchSequence();
    await vi.waitFor(() => expect(refs.caption.textContent).toBe(FINAL_CAPTION));
    // The real success path (not the space-scene-failed fallback) adds
    // `is-visible` to the canvas.
    expect(refs.canvas.classList.contains("is-visible")).toBe(true);

    stopLaunchSequence();
    startLaunchSequence(refs);
    skipLaunchSequence();
    await vi.waitFor(() => expect(refs.caption.textContent).toBe(FINAL_CAPTION));

    // If the second run had reused the first run's now-context-lost canvas,
    // building the scene would throw, land on the finishWithoutScene
    // fallback instead, and never add `is-visible`.
    expect(refs.canvas.classList.contains("is-visible")).toBe(true);
    expect(errorSpy).not.toHaveBeenCalled();

    stopLaunchSequence();
    errorSpy.mockRestore();
  });
});

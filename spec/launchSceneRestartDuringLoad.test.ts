// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

// How many textures buildScene() loads per run (see the Promise.all in
// src/scripts/launchScene.ts's buildScene) -- used below to know when a run's
// texture loads have all been *requested* (not yet resolved), so we can hold
// them open and control exactly when each run's scene build finishes.
const TEXTURES_PER_BUILD = 9;

const gate = vi.hoisted(() => ({ resolvers: [] as Array<() => void> }));

// Same fake as spec/launchSceneRestart.test.ts, plus a controllable
// TextureLoader: its loadAsync() never resolves on its own, so a test can
// pause a scene build right after its WebGLRenderer is constructed (the first
// synchronous line of buildScene) and before the scene is ever assigned --
// exactly the "stopped mid-load" window a restart can land in.
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

  // Resolves with the same infinitely-chainable auto-mock every other THREE
  // export uses -- a plain object here would break downstream code that
  // treats the loaded texture as chainable (e.g. `tex.image.something`),
  // since only the Proxy tolerates arbitrary property/method access.
  class GatedTextureLoader {
    loadAsync(): Promise<unknown> {
      return new Promise((resolve) => {
        gate.resolvers.push(() => resolve(auto));
      });
    }
  }
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
  ];
  const namespace: Record<string, unknown> = {
    WebGLRenderer: FakeWebGLRenderer,
    Vector3: MiniVector3,
    TextureLoader: GatedTextureLoader,
  };
  for (const name of namedExports) namespace[name] = auto;
  return namespace;
});

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

function makeRefs() {
  return {
    ground: document.createElement("div"),
    canvas: document.createElement("canvas"),
    caption: document.createElement("p"),
    skipButton: document.createElement("button"),
  };
}

// Waits for the next run's texture loads to all have been requested, then
// claims exactly that batch so a later run's requests can't be mistaken for
// this one's.
async function claimNextBuildsResolvers(): Promise<Array<() => void>> {
  await vi.waitFor(() => expect(gate.resolvers.length).toBe(TEXTURES_PER_BUILD));
  return gate.resolvers.splice(0, TEXTURES_PER_BUILD);
}

describe("launch sequence: restart while the scene is still loading", () => {
  it("renews the canvas on stop even before the in-flight scene build has resolved", async () => {
    const refs = makeRefs();
    const originalCanvas = refs.canvas;

    startLaunchSequence(refs);
    // skipLaunchSequence() kicks off ensureScene()'s async chain -- its first
    // line is `await import("three")`, a dynamic import that always yields
    // before running anything else, so calling stop synchronously right
    // after is guaranteed to catch it before `scene` is ever assigned.
    skipLaunchSequence();
    stopLaunchSequence();

    expect(refs.canvas).not.toBe(originalCanvas);

    // Stopping doesn't cancel the orphaned build already in flight -- it
    // keeps running in the background and will still reach the (gated)
    // texture-load stage. Drain and discard those requests here so they
    // can't land in `gate.resolvers` at some unpredictable later point
    // during the next test (this mock's state is module-scoped, shared
    // across every test in the file).
    await claimNextBuildsResolvers();
  });
});

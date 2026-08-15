import earthTextureUrl from "../assets/textures/earth.jpg";
import earthCloudsTextureUrl from "../assets/textures/earth_clouds.jpg";
import venusTextureUrl from "../assets/textures/venus.jpg";
import marsTextureUrl from "../assets/textures/mars.jpg";
import jupiterTextureUrl from "../assets/textures/jupiter.jpg";
import saturnTextureUrl from "../assets/textures/saturn.jpg";
import saturnRingUrl from "../assets/textures/saturn_ring.png";
import sunTextureUrl from "../assets/textures/sun.jpg";
import { makeGlowTexture, makeMetalTexture, makeRingTextureFromStrip } from "./proceduralTextures";

export interface LaunchRefs {
  ground: HTMLElement;
  canvas: HTMLCanvasElement;
  caption: HTMLElement;
  skipButton: HTMLButtonElement;
}

type Vec3 = [number, number, number];

interface WideStage {
  mode: "wide";
  caption: string;
  duration: number;
  camFrom: Vec3;
  camTo: Vec3;
  lookFrom: Vec3;
  lookTo: Vec3;
  rocketFrom: Vec3;
  rocketTo: Vec3;
}

interface ChaseStage {
  mode: "chase";
  caption: string;
  duration: number;
  rocketFrom: Vec3;
  rocketTo: Vec3;
  // Camera position/lookAt are the rocket's live position plus these eased
  // offsets, so the shot follows the rocket instead of holding a fixed frame.
  chaseOffsetFrom: Vec3;
  chaseOffsetTo: Vec3;
  lookAheadFrom: Vec3;
  lookAheadTo: Vec3;
}

type Stage = WideStage | ChaseStage;

// World layout: Earth at the origin, everything else placed along the
// rocket's outbound path so the two chase stages fly close past them.
const STAGES: Stage[] = [
  {
    mode: "wide",
    caption: "Leaving Earth",
    duration: 3000,
    camFrom: [0, 1.6, 4.8],
    camTo: [0, 2.8, 6.5],
    lookFrom: [0, 1, 0],
    lookTo: [0, 2.2, 0],
    rocketFrom: [0, 1.1, 0],
    rocketTo: [0, 2.4, 0],
  },
  {
    mode: "chase",
    caption: "Out into space",
    duration: 3000,
    rocketFrom: [0, 2.4, 0],
    rocketTo: [5, 2, -20],
    chaseOffsetFrom: [0, 1.3, 5.5],
    chaseOffsetTo: [0, 0.9, 3.4],
    lookAheadFrom: [0, 0, -6],
    lookAheadTo: [2, 0, -10],
  },
  {
    mode: "chase",
    caption: "Past the solar system",
    duration: 3000,
    rocketFrom: [5, 2, -20],
    rocketTo: [-9, 8, -80],
    chaseOffsetFrom: [0, 1, 4],
    chaseOffsetTo: [0, 2.5, 7],
    lookAheadFrom: [-3, 1, -12],
    lookAheadTo: [0, 1, -14],
  },
  {
    mode: "wide",
    caption: "Into empty space",
    duration: 2500,
    camFrom: [-9, 20, -40],
    camTo: [-22, 55, -250],
    lookFrom: [-9, 8, -80],
    lookTo: [-16, 11, -170],
    rocketFrom: [-9, 8, -80],
    rocketTo: [-15, 11, -140],
  },
];

const GROUND_WALK_MS = 2000;
const GROUND_BOARD_MS = 1000;
const GROUND_LIFTOFF_MS = 2200;
const CROSSFADE_LEAD_MS = 400;

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

interface SceneController {
  renderPose(stageIndex: number, t: number): void;
  handleResize(): void;
  dispose(): void;
}

interface PlanetSpec {
  radius: number;
  position: Vec3;
  texture: InstanceType<typeof import("three").Texture>;
  ring?: boolean;
}

async function buildScene(
  THREE: typeof import("three"),
  canvas: HTMLCanvasElement,
): Promise<SceneController> {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 3000);
  const scene = new THREE.Scene();

  const loader = new THREE.TextureLoader();
  const [earthTex, earthCloudsTex, sunTex, venusTex, marsTex, jupiterTex, saturnTex, saturnRingSource] =
    await Promise.all([
      loader.loadAsync(earthTextureUrl.src),
      loader.loadAsync(earthCloudsTextureUrl.src),
      loader.loadAsync(sunTextureUrl.src),
      loader.loadAsync(venusTextureUrl.src),
      loader.loadAsync(marsTextureUrl.src),
      loader.loadAsync(jupiterTextureUrl.src),
      loader.loadAsync(saturnTextureUrl.src),
      loader.loadAsync(saturnRingUrl.src),
    ]);
  for (const tex of [earthTex, sunTex, venusTex, marsTex, jupiterTex, saturnTex]) {
    tex.colorSpace = THREE.SRGBColorSpace;
  }

  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(1, 32, 24),
    new THREE.MeshStandardMaterial({ map: earthTex, roughness: 0.85 }),
  );
  scene.add(earth);

  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(1.08, 32, 24),
    new THREE.MeshBasicMaterial({
      color: 0x8ab4ff,
      transparent: true,
      opacity: 0.25,
      side: THREE.BackSide,
    }),
  );
  scene.add(atmosphere);

  const clouds = new THREE.Mesh(
    new THREE.SphereGeometry(1.035, 32, 24),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      alphaMap: earthCloudsTex,
      transparent: true,
      depthWrite: false,
      roughness: 1,
    }),
  );
  scene.add(clouds);

  const metalTexture = makeMetalTexture(THREE);
  const rocket = new THREE.Group();

  const rocketBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.2, 1.1, 16),
    new THREE.MeshStandardMaterial({ map: metalTexture, roughness: 0.4, metalness: 0.6 }),
  );
  rocket.add(rocketBody);

  const rocketNose = new THREE.Mesh(
    new THREE.ConeGeometry(0.2, 0.5, 16),
    new THREE.MeshStandardMaterial({ color: 0xeaf6ff, roughness: 0.3, metalness: 0.3 }),
  );
  rocketNose.position.y = 1.1 / 2 + 0.5 / 2;
  rocket.add(rocketNose);

  const rocketNozzle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.18, 0.24, 16),
    new THREE.MeshStandardMaterial({ color: 0x53586a, roughness: 0.5, metalness: 0.7 }),
  );
  rocketNozzle.position.y = -1.1 / 2 - 0.12;
  rocket.add(rocketNozzle);

  const finMaterial = new THREE.MeshStandardMaterial({ color: 0x8ab4ff, roughness: 0.5 });
  for (let i = 0; i < 3; i += 1) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.32), finMaterial);
    const angle = (i / 3) * Math.PI * 2;
    fin.position.set(Math.cos(angle) * 0.26, -1.1 / 2 + 0.05, Math.sin(angle) * 0.26);
    fin.rotation.y = angle;
    rocket.add(fin);
  }

  const flame = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: makeGlowTexture(THREE),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  flame.scale.set(0.5, 0.9, 1);
  flame.position.y = -1.1 / 2 - 0.4;
  rocket.add(flame);
  scene.add(rocket);

  const sun = new THREE.Mesh(new THREE.SphereGeometry(5.5, 24, 16), new THREE.MeshBasicMaterial({ map: sunTex }));
  sun.position.set(0, 8, -60);
  scene.add(sun);

  const sunLight = new THREE.PointLight(0xfff2d0, 4, 0, 0);
  sunLight.position.copy(sun.position);
  scene.add(sunLight);

  const ambientLight = new THREE.AmbientLight(0x404050, 0.55);
  scene.add(ambientLight);

  const corona = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: makeGlowTexture(THREE),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  corona.scale.set(17, 17, 1);
  corona.position.copy(sun.position);
  scene.add(corona);

  // Offset from the rocket's own waypoints (see STAGES) so the close chase
  // camera passes beside each body instead of arriving exactly inside it.
  const planetSpecs: PlanetSpec[] = [
    { radius: 0.85, position: [10, 5, -28], texture: venusTex },
    { radius: 0.7, position: [-7, 3, -35], texture: marsTex },
    { radius: 2.3, position: [9, -2, -50], texture: jupiterTex },
    { radius: 1.8, position: [-16, 12, -92], texture: saturnTex, ring: true },
  ];
  for (const spec of planetSpecs) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(spec.radius, 24, 16),
      new THREE.MeshStandardMaterial({ map: spec.texture, roughness: 0.9 }),
    );
    mesh.position.set(...spec.position);
    scene.add(mesh);

    if (spec.ring) {
      const ringTexture = makeRingTextureFromStrip(THREE, saturnRingSource.image as HTMLImageElement, 256);
      const ring = new THREE.Mesh(
        new THREE.PlaneGeometry(spec.radius * 3.6, spec.radius * 3.6),
        new THREE.MeshBasicMaterial({
          map: ringTexture,
          transparent: true,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      ring.rotation.x = -Math.PI / 2.6;
      ring.position.copy(mesh.position);
      scene.add(ring);
    }
  }

  const starCount = 2000;
  const starPositions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i += 1) {
    const radius = 150 + Math.random() * 250;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);
    starPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    starPositions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    starPositions[i * 3 + 2] = radius * Math.cos(phi);
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
  const stars = new THREE.Points(
    starGeometry,
    new THREE.PointsMaterial({ color: 0xffffff, size: 1.2, sizeAttenuation: true }),
  );
  scene.add(stars);

  function resize(): void {
    const width = canvas.clientWidth || 1;
    const height = canvas.clientHeight || 1;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height, false);
  }

  const upAxis = new THREE.Vector3(0, 1, 0);
  const heading = new THREE.Vector3();

  function renderPose(stageIndex: number, t: number): void {
    const stage = STAGES[stageIndex] ?? STAGES[STAGES.length - 1];
    const eased = easeInOutCubic(t);

    const rocketPos: Vec3 = [
      lerp(stage.rocketFrom[0], stage.rocketTo[0], eased),
      lerp(stage.rocketFrom[1], stage.rocketTo[1], eased),
      lerp(stage.rocketFrom[2], stage.rocketTo[2], eased),
    ];
    rocket.position.set(...rocketPos);

    heading.set(
      stage.rocketTo[0] - stage.rocketFrom[0],
      stage.rocketTo[1] - stage.rocketFrom[1],
      stage.rocketTo[2] - stage.rocketFrom[2],
    );
    if (heading.lengthSq() > 0.0001) {
      rocket.quaternion.setFromUnitVectors(upAxis, heading.normalize());
    }
    flame.visible = stageIndex === 0;

    if (stage.mode === "wide") {
      camera.position.set(
        lerp(stage.camFrom[0], stage.camTo[0], eased),
        lerp(stage.camFrom[1], stage.camTo[1], eased),
        lerp(stage.camFrom[2], stage.camTo[2], eased),
      );
      camera.lookAt(
        lerp(stage.lookFrom[0], stage.lookTo[0], eased),
        lerp(stage.lookFrom[1], stage.lookTo[1], eased),
        lerp(stage.lookFrom[2], stage.lookTo[2], eased),
      );
    } else {
      camera.position.set(
        rocketPos[0] + lerp(stage.chaseOffsetFrom[0], stage.chaseOffsetTo[0], eased),
        rocketPos[1] + lerp(stage.chaseOffsetFrom[1], stage.chaseOffsetTo[1], eased),
        rocketPos[2] + lerp(stage.chaseOffsetFrom[2], stage.chaseOffsetTo[2], eased),
      );
      camera.lookAt(
        rocketPos[0] + lerp(stage.lookAheadFrom[0], stage.lookAheadTo[0], eased),
        rocketPos[1] + lerp(stage.lookAheadFrom[1], stage.lookAheadTo[1], eased),
        rocketPos[2] + lerp(stage.lookAheadFrom[2], stage.lookAheadTo[2], eased),
      );
    }

    renderer.render(scene, camera);
  }

  function dispose(): void {
    scene.traverse((object) => {
      const drawable = object as InstanceType<typeof THREE.Mesh> | InstanceType<typeof THREE.Points>;
      drawable.geometry?.dispose();
      const material = drawable.material;
      if (Array.isArray(material)) {
        for (const entry of material) entry.dispose();
      } else {
        material?.dispose();
      }
    });
    renderer.dispose();
    renderer.forceContextLoss();
  }

  resize();
  return { renderPose, handleResize: resize, dispose };
}

// A ground-phase delay (walk -> board -> liftoff -> crossfade) that can be
// frozen mid-countdown and resumed later with whatever time it had left --
// unlike a bare `setTimeout`, which keeps counting wall-clock time even
// while the tab is hidden (see CLAUDE.md).
interface GroundTimer {
  callback: () => void;
  remaining: number;
  handle: number | null;
  armedAt: number;
  fired: boolean;
}

interface ActiveSequence {
  refs: LaunchRefs;
  groundTimers: GroundTimer[];
  raf: number | null;
  scene: SceneController | null;
  sceneLoading: Promise<SceneController> | null;
  resizeListener: (() => void) | null;
  finished: boolean;
}

let active: ActiveSequence | null = null;

function armGroundTimer(timer: GroundTimer): void {
  timer.armedAt = performance.now();
  timer.handle = window.setTimeout(() => {
    timer.handle = null;
    timer.fired = true;
    timer.callback();
  }, timer.remaining);
}

function scheduleGroundTimer(sequence: ActiveSequence, delay: number, callback: () => void): void {
  const timer: GroundTimer = { callback, remaining: delay, handle: null, armedAt: 0, fired: false };
  sequence.groundTimers.push(timer);
  if (!document.hidden) armGroundTimer(timer);
}

function clearGroundTimeouts(sequence: ActiveSequence): void {
  for (const timer of sequence.groundTimers) {
    if (timer.handle !== null) window.clearTimeout(timer.handle);
  }
  sequence.groundTimers = [];
}

function pauseGroundTimers(sequence: ActiveSequence): void {
  const now = performance.now();
  for (const timer of sequence.groundTimers) {
    if (timer.handle === null) continue;
    window.clearTimeout(timer.handle);
    timer.handle = null;
    timer.remaining = Math.max(0, timer.remaining - (now - timer.armedAt));
  }
}

function resumeGroundTimers(sequence: ActiveSequence): void {
  // A timer that already fired naturally also has `handle === null` (cleared
  // right before its callback ran) -- without the `fired` check, resuming
  // after any later hide/reveal cycle would re-arm and refire it, e.g.
  // replaying the crossfade into the space scene from scratch.
  for (const timer of sequence.groundTimers) {
    if (timer.handle === null && !timer.fired) armGroundTimer(timer);
  }
}

// The ground phase's setTimeout chain doesn't pause itself when the tab is
// hidden (unlike the space scene's rAF loop, which the browser already
// suspends) -- so freeze its timers and its CSS animations together here,
// and resume both from wherever they left off.
document.addEventListener("visibilitychange", () => {
  if (!active) return;
  if (document.hidden) {
    pauseGroundTimers(active);
    active.refs.ground.classList.add("is-paused");
  } else {
    active.refs.ground.classList.remove("is-paused");
    resumeGroundTimers(active);
  }
});

function resetGroundLayer(refs: LaunchRefs): void {
  refs.ground.hidden = false;
  refs.ground.classList.remove("is-fading", "is-paused");
  refs.ground.querySelector(".launch-twin-go")?.classList.remove("is-walking", "is-boarding");
  refs.ground.querySelector(".launch-rocket")?.classList.remove("is-igniting", "is-lifting");
  refs.canvas.classList.remove("is-visible");
  refs.caption.textContent = "";
  refs.skipButton.hidden = false;
  refs.skipButton.disabled = false;
}

async function ensureScene(sequence: ActiveSequence): Promise<SceneController> {
  if (sequence.scene) return sequence.scene;
  if (sequence.sceneLoading) return sequence.sceneLoading;

  const loading = (async () => {
    const THREE = await import("three");
    const scene = await buildScene(THREE, sequence.refs.canvas);
    if (active !== sequence) {
      scene.dispose();
      throw new Error("launch sequence was stopped before the scene finished loading");
    }
    sequence.scene = scene;
    sequence.resizeListener = () => scene.handleResize();
    window.addEventListener("resize", sequence.resizeListener);
    window.addEventListener("orientationchange", sequence.resizeListener);
    return scene;
  })();

  // A failed load (dropped network request, chunk-load error) must not be
  // cached forever -- otherwise a later retry (e.g. clicking Skip) would
  // just replay the same dead rejected promise and silently do nothing.
  sequence.sceneLoading = loading.catch((error: unknown) => {
    if (sequence.sceneLoading === loading) sequence.sceneLoading = null;
    throw error;
  });
  return sequence.sceneLoading;
}

// The space scene failed to load (network hiccup, WebGL unavailable, etc).
// Finish the story without it rather than leaving the ground scene stuck
// forever with no way to progress.
function finishWithoutScene(sequence: ActiveSequence, error: unknown): void {
  console.error("Launch sequence: space scene failed to load, skipping to the end.", error);
  sequence.refs.ground.hidden = true;
  sequence.refs.caption.textContent = STAGES[STAGES.length - 1].caption;
  finishSequence(sequence);
}

function runSpaceCutscene(sequence: ActiveSequence, scene: SceneController): void {
  let stageIndex = 0;
  let stageElapsed = 0;
  let lastTs = 0;
  sequence.refs.caption.textContent = STAGES[0].caption;

  function tick(ts: number): void {
    if (active !== sequence) return;
    if (lastTs === 0) lastTs = ts;
    const delta = Math.min(ts - lastTs, 100);
    lastTs = ts;
    stageElapsed += delta;

    let stage = STAGES[stageIndex];
    while (stageElapsed >= stage.duration && stageIndex < STAGES.length - 1) {
      stageElapsed -= stage.duration;
      stageIndex += 1;
      stage = STAGES[stageIndex];
      sequence.refs.caption.textContent = stage.caption;
    }

    const isLast = stageIndex === STAGES.length - 1;
    const t = isLast ? Math.min(stageElapsed / stage.duration, 1) : stageElapsed / stage.duration;
    scene.renderPose(stageIndex, t);

    if (isLast && stageElapsed >= stage.duration) {
      finishSequence(sequence);
      return;
    }
    sequence.raf = requestAnimationFrame(tick);
  }

  sequence.raf = requestAnimationFrame(tick);
}

function finishSequence(sequence: ActiveSequence): void {
  sequence.finished = true;
  sequence.raf = null;
  sequence.refs.skipButton.hidden = true;
}

async function crossFadeIntoScene(sequence: ActiveSequence): Promise<void> {
  let scene: SceneController;
  try {
    scene = await ensureScene(sequence);
  } catch (error) {
    if (active === sequence) finishWithoutScene(sequence, error);
    return;
  }
  if (active !== sequence) return;
  scene.renderPose(0, 0);
  sequence.refs.canvas.classList.add("is-visible");
  sequence.refs.ground.classList.add("is-fading");
  scheduleGroundTimer(sequence, 800, () => {
    sequence.refs.ground.hidden = true;
  });
  runSpaceCutscene(sequence, scene);
}

function playGroundSequence(sequence: ActiveSequence): void {
  const { ground } = sequence.refs;
  const twinGo = ground.querySelector(".launch-twin-go");
  const rocket = ground.querySelector(".launch-rocket");

  twinGo?.classList.add("is-walking");
  scheduleGroundTimer(sequence, GROUND_WALK_MS, () => {
    twinGo?.classList.remove("is-walking");
    twinGo?.classList.add("is-boarding");
    rocket?.classList.add("is-igniting");
  });

  scheduleGroundTimer(sequence, GROUND_WALK_MS + GROUND_BOARD_MS, () => {
    rocket?.classList.add("is-lifting");
  });

  scheduleGroundTimer(sequence, GROUND_WALK_MS + GROUND_BOARD_MS + GROUND_LIFTOFF_MS - CROSSFADE_LEAD_MS, () => {
    void crossFadeIntoScene(sequence);
  });
}

export function startLaunchSequence(refs: LaunchRefs): void {
  if (active) stopLaunchSequence();

  const sequence: ActiveSequence = {
    refs,
    groundTimers: [],
    raf: null,
    scene: null,
    sceneLoading: null,
    resizeListener: null,
    finished: false,
  };
  active = sequence;
  resetGroundLayer(refs);

  if (prefersReducedMotion()) {
    refs.ground.hidden = true;
    void ensureScene(sequence).then(
      (scene) => {
        if (active !== sequence) return;
        refs.canvas.classList.add("is-visible");
        scene.renderPose(STAGES.length - 1, 1);
        refs.caption.textContent = STAGES[STAGES.length - 1].caption;
        finishSequence(sequence);
      },
      (error: unknown) => {
        if (active === sequence) finishWithoutScene(sequence, error);
      },
    );
    return;
  }

  playGroundSequence(sequence);
}

export function skipLaunchSequence(): void {
  const sequence = active;
  if (!sequence || sequence.finished) return;

  clearGroundTimeouts(sequence);
  if (sequence.raf !== null) cancelAnimationFrame(sequence.raf);
  sequence.refs.ground.hidden = true;
  sequence.refs.canvas.classList.add("is-visible");

  void ensureScene(sequence).then(
    (scene) => {
      if (active !== sequence) return;
      scene.renderPose(STAGES.length - 1, 1);
      sequence.refs.caption.textContent = STAGES[STAGES.length - 1].caption;
      finishSequence(sequence);
    },
    (error: unknown) => {
      if (active === sequence) finishWithoutScene(sequence, error);
    },
  );
}

export function stopLaunchSequence(): void {
  const sequence = active;
  if (!sequence) return;
  active = null;

  clearGroundTimeouts(sequence);
  if (sequence.raf !== null) cancelAnimationFrame(sequence.raf);
  if (sequence.resizeListener) {
    window.removeEventListener("resize", sequence.resizeListener);
    window.removeEventListener("orientationchange", sequence.resizeListener);
  }
  sequence.scene?.dispose();
  resetGroundLayer(sequence.refs);
}

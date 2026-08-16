import mercuryTextureUrl from "../assets/textures/mercury.jpg";
import earthTextureUrl from "../assets/textures/earth.jpg";
import earthCloudsTextureUrl from "../assets/textures/earth_clouds.jpg";
import venusTextureUrl from "../assets/textures/venus.jpg";
import marsTextureUrl from "../assets/textures/mars.jpg";
import jupiterTextureUrl from "../assets/textures/jupiter.jpg";
import saturnTextureUrl from "../assets/textures/saturn.jpg";
import saturnRingUrl from "../assets/textures/saturn_ring.png";
import sunTextureUrl from "../assets/textures/sun.jpg";
import { makeDotTexture, makeGlowTexture, makeMetalTexture, makeRingTextureFromStrip } from "./proceduralTextures";

export interface LaunchRefs {
  ground: HTMLElement;
  canvas: HTMLCanvasElement;
  caption: HTMLElement;
  skipButton: HTMLButtonElement;
}

type Vec3 = [number, number, number];

// A single continuous flight path: each keyframe pins the rocket's position
// plus the camera's rocket-relative offset/look-at at that instant.
// buildSegments() pairs consecutive keyframes into legs, so a leg's outgoing
// camera values are always exactly the next leg's incoming ones -- camera
// framing can never jump at a leg boundary, only ease continuously. This is
// what replaces the old wide/chase "hard cut" between stages.
interface Keyframe {
  caption: string;
  rocketPos: Vec3;
  camOffset: Vec3;
  lookAhead: Vec3;
}

interface Segment {
  caption: string;
  duration: number;
  rocketFrom: Vec3;
  rocketTo: Vec3;
  camOffsetFrom: Vec3;
  camOffsetTo: Vec3;
  lookAheadFrom: Vec3;
  lookAheadTo: Vec3;
}

// World layout: Earth at the origin, Sun and inner planets (Mercury, Venus)
// behind the launch point in +Z so the outbound flight (always Z <= 0) never
// comes near the Sun. Mars, the asteroid belt, Jupiter and Saturn sit
// progressively further along a single straight outbound line (rocketPos(s)
// = base + s * direction for a fixed direction, so the path never changes
// course) in the correct real-world distance-from-Sun order.
//
// The flight is two scenes, each with one constant, non-swinging camOffset/
// lookAhead: a wide liftoff shot that keeps the Sun in view over the rocket's
// shoulder while it climbs straight up, then a single trailing chase camera
// for the entire straight-line flight past the planets -- no per-planet
// camera aim, so nothing "swings" to frame any one body. The camera sits far
// enough behind and looks far enough ahead that each planet's own sideways
// clearance from the flight line still keeps it inside the (narrower, on
// phone) field of view as the rocket passes it.
// Y raised from the straight camera-to-rocket line so the sun (fixed in
// world space, off to the side of Earth) doesn't sit almost exactly behind
// Earth from the camera's viewpoint -- the original offset put the two
// within ~2.6deg of each other, so Earth's near (unlit) hemisphere eclipsed
// the sun instead of leaving it visible as its own disc in the sky. Verified
// with /tmp/liftoff_search2.mjs: +7 on Y gives ~23.6deg of separation (versus
// the ~16deg the two discs' angular radii need to clear each other) while the
// sun stays inside both viewports' vertical FOV (its pitch, ~18deg, is well
// under the 25deg half-FOV) and independent of aspect ratio, unlike yaw.
const LIFTOFF_CAM_OFFSET: Vec3 = [-4.22, 0.67, -10.54];
const LIFTOFF_LOOKAHEAD: Vec3 = [0, 0, 0];
const FLIGHT_CAM_OFFSET: Vec3 = [-3.86, 0.04, 34.77];
const FLIGHT_LOOKAHEAD: Vec3 = [4.64, 1.39, -41.72];

const KEYFRAMES: Keyframe[] = [
  {
    caption: "Leaving Earth",
    rocketPos: [0, 1.1, 0],
    camOffset: LIFTOFF_CAM_OFFSET,
    lookAhead: LIFTOFF_LOOKAHEAD,
  },
  {
    caption: "Climbing away from Earth",
    rocketPos: [0, 2.6, 0],
    camOffset: LIFTOFF_CAM_OFFSET,
    lookAhead: LIFTOFF_LOOKAHEAD,
  },
  {
    caption: "Passing Mars",
    rocketPos: [0, 2.6, 0],
    camOffset: FLIGHT_CAM_OFFSET,
    lookAhead: FLIGHT_LOOKAHEAD,
  },
  {
    caption: "Through the asteroid belt",
    rocketPos: [3.5, 3.65, -31.5],
    camOffset: FLIGHT_CAM_OFFSET,
    lookAhead: FLIGHT_LOOKAHEAD,
  },
  {
    caption: "Jupiter's giant bulk",
    rocketPos: [5.5, 4.25, -49.5],
    camOffset: FLIGHT_CAM_OFFSET,
    lookAhead: FLIGHT_LOOKAHEAD,
  },
  {
    caption: "Saturn flyby",
    rocketPos: [8, 5, -72],
    camOffset: FLIGHT_CAM_OFFSET,
    lookAhead: FLIGHT_LOOKAHEAD,
  },
  {
    caption: "Out past Saturn",
    rocketPos: [13.5, 6.65, -121.5],
    camOffset: FLIGHT_CAM_OFFSET,
    lookAhead: FLIGHT_LOOKAHEAD,
  },
  {
    caption: "Into empty space",
    rocketPos: [17, 7.7, -153],
    camOffset: FLIGHT_CAM_OFFSET,
    lookAhead: FLIGHT_LOOKAHEAD,
  },
  {
    caption: "Into empty space",
    rocketPos: [20, 8.6, -180],
    camOffset: FLIGHT_CAM_OFFSET,
    lookAhead: FLIGHT_LOOKAHEAD,
  },
];

const LEG_DURATIONS = [1400, 1500, 2200, 1800, 2000, 2600, 1800, 2200];

function buildSegments(keyframes: Keyframe[], durations: number[]): Segment[] {
  const segments: Segment[] = [];
  for (let i = 0; i < keyframes.length - 1; i += 1) {
    const from = keyframes[i];
    const to = keyframes[i + 1];
    segments.push({
      caption: from.caption,
      duration: durations[i],
      rocketFrom: from.rocketPos,
      rocketTo: to.rocketPos,
      camOffsetFrom: from.camOffset,
      camOffsetTo: to.camOffset,
      lookAheadFrom: from.lookAhead,
      lookAheadTo: to.lookAhead,
    });
  }
  return segments;
}

const SEGMENTS: Segment[] = buildSegments(KEYFRAMES, LEG_DURATIONS);

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
  renderPose(segmentIndex: number, t: number): void;
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
  const [earthTex, earthCloudsTex, sunTex, mercuryTex, venusTex, marsTex, jupiterTex, saturnTex, saturnRingSource] =
    await Promise.all([
      loader.loadAsync(earthTextureUrl.src),
      loader.loadAsync(earthCloudsTextureUrl.src),
      loader.loadAsync(sunTextureUrl.src),
      loader.loadAsync(mercuryTextureUrl.src),
      loader.loadAsync(venusTextureUrl.src),
      loader.loadAsync(marsTextureUrl.src),
      loader.loadAsync(jupiterTextureUrl.src),
      loader.loadAsync(saturnTextureUrl.src),
      loader.loadAsync(saturnRingUrl.src),
    ]);
  for (const tex of [earthTex, sunTex, mercuryTex, venusTex, marsTex, jupiterTex, saturnTex]) {
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
  sun.position.set(6, 9, 15);
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

  // Real outward order from the Sun: Mercury, Venus, Earth, Mars, the
  // asteroid belt (see the Points cloud below), Jupiter, Saturn -- Mercury
  // and Venus sit behind the launch point (never visited close, same as the
  // real inner planets relative to an outbound flight), the rest sit off to
  // the side of the single straight flight line by just enough clearance for
  // a close-but-clear pass while staying inside the camera's field of view
  // (verified by script, including on a narrow phone aspect ratio).
  const planetSpecs: PlanetSpec[] = [
    { radius: 0.5, position: [10, 8, 8], texture: mercuryTex },
    { radius: 0.85, position: [8, 7, 3], texture: venusTex },
    // Mars sits near Venus in world space rather than further down the flight
    // line -- the chase camera trails ~35 units behind the rocket (see
    // FLIGHT_CAM_OFFSET), so a planet placed at the rocket's own "Passing
    // Mars" keyframe position isn't actually close to the CAMERA until a
    // whole caption later. Placing Mars here instead means it's already
    // growing large and on-screen while "Passing Mars" is showing, verified
    // with /tmp/mars_fix2.mjs (angular diameter grows from ~2.5deg to ~7deg
    // across the segment on desktop without ever going behind the camera).
    { radius: 0.7, position: [3, 4, 4], texture: marsTex },
    { radius: 2.3, position: [11.2, 3.5, -61.8], texture: jupiterTex },
    { radius: 1.8, position: [8.4, 8.2, -109.2], texture: saturnTex, ring: true },
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

  // A lightweight asteroid-belt flourish between the Mars and Jupiter legs --
  // a sparse ring of small grey points, not individual meshes, so it reads as
  // rubble to fly through rather than another set of solid bodies to avoid.
  // Centered directly on the flight line (not off to the side, unlike the
  // planets) since it's meant to be flown through, not passed at a distance.
  const beltCenter: Vec3 = [4.8, 4.04, -43.2];
  const beltCount = 260;
  const beltPositions = new Float32Array(beltCount * 3);
  for (let i = 0; i < beltCount; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    // Capped at 20 (not the ring's full 24 span) so the belt's footprint
    // stops short of Jupiter, ~19.7 units from beltCenter -- otherwise
    // stray points render on top of it during "Jupiter's giant bulk".
    const ringRadius = 10 + Math.random() * 10;
    const spread = (Math.random() - 0.5) * 6;
    beltPositions[i * 3] = beltCenter[0] + Math.cos(angle) * ringRadius;
    beltPositions[i * 3 + 1] = beltCenter[1] + spread;
    beltPositions[i * 3 + 2] = beltCenter[2] + Math.sin(angle) * ringRadius;
  }
  const beltGeometry = new THREE.BufferGeometry();
  beltGeometry.setAttribute("position", new THREE.BufferAttribute(beltPositions, 3));
  const belt = new THREE.Points(
    beltGeometry,
    new THREE.PointsMaterial({
      color: 0x8a7f6b,
      // Small enough to read as dust motes, not blobs comparable in size to
      // Mercury (radius 0.5) -- 0.6 rendered as oversized blurry circles.
      size: 0.15,
      sizeAttenuation: true,
      map: makeDotTexture(THREE),
      transparent: true,
      depthWrite: false,
    }),
  );
  scene.add(belt);

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

  function renderPose(segmentIndex: number, t: number): void {
    const segment = SEGMENTS[segmentIndex] ?? SEGMENTS[SEGMENTS.length - 1];
    const eased = easeInOutCubic(t);

    const rocketPos: Vec3 = [
      lerp(segment.rocketFrom[0], segment.rocketTo[0], eased),
      lerp(segment.rocketFrom[1], segment.rocketTo[1], eased),
      lerp(segment.rocketFrom[2], segment.rocketTo[2], eased),
    ];
    rocket.position.set(...rocketPos);

    heading.set(
      segment.rocketTo[0] - segment.rocketFrom[0],
      segment.rocketTo[1] - segment.rocketFrom[1],
      segment.rocketTo[2] - segment.rocketFrom[2],
    );
    if (heading.lengthSq() > 0.0001) {
      rocket.quaternion.setFromUnitVectors(upAxis, heading.normalize());
    }
    flame.visible = segmentIndex <= 1;

    // Camera is always the rocket's own position plus an eased offset/look-at
    // -- one formula for the whole flight, so there's no mode boundary left
    // to cut across (see buildSegments(): adjacent legs share their offset
    // values by construction, so this is continuous everywhere).
    camera.position.set(
      rocketPos[0] + lerp(segment.camOffsetFrom[0], segment.camOffsetTo[0], eased),
      rocketPos[1] + lerp(segment.camOffsetFrom[1], segment.camOffsetTo[1], eased),
      rocketPos[2] + lerp(segment.camOffsetFrom[2], segment.camOffsetTo[2], eased),
    );
    camera.lookAt(
      rocketPos[0] + lerp(segment.lookAheadFrom[0], segment.lookAheadTo[0], eased),
      rocketPos[1] + lerp(segment.lookAheadFrom[1], segment.lookAheadTo[1], eased),
      rocketPos[2] + lerp(segment.lookAheadFrom[2], segment.lookAheadTo[2], eased),
    );

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
  sequence.refs.caption.textContent = SEGMENTS[SEGMENTS.length - 1].caption;
  finishSequence(sequence);
}

function runSpaceCutscene(sequence: ActiveSequence, scene: SceneController): void {
  let segmentIndex = 0;
  let segmentElapsed = 0;
  let lastTs = 0;
  sequence.refs.caption.textContent = SEGMENTS[0].caption;

  function tick(ts: number): void {
    if (active !== sequence) return;
    if (lastTs === 0) lastTs = ts;
    const delta = Math.min(ts - lastTs, 100);
    lastTs = ts;
    segmentElapsed += delta;

    let segment = SEGMENTS[segmentIndex];
    while (segmentElapsed >= segment.duration && segmentIndex < SEGMENTS.length - 1) {
      segmentElapsed -= segment.duration;
      segmentIndex += 1;
      segment = SEGMENTS[segmentIndex];
      sequence.refs.caption.textContent = segment.caption;
    }

    const isLast = segmentIndex === SEGMENTS.length - 1;
    const t = isLast ? Math.min(segmentElapsed / segment.duration, 1) : segmentElapsed / segment.duration;
    scene.renderPose(segmentIndex, t);

    if (isLast && segmentElapsed >= segment.duration) {
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
        scene.renderPose(SEGMENTS.length - 1, 1);
        refs.caption.textContent = SEGMENTS[SEGMENTS.length - 1].caption;
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
      scene.renderPose(SEGMENTS.length - 1, 1);
      sequence.refs.caption.textContent = SEGMENTS[SEGMENTS.length - 1].caption;
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

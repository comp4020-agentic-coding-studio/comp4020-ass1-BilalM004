export interface LaunchRefs {
  ground: HTMLElement;
  canvas: HTMLCanvasElement;
  caption: HTMLElement;
  skipButton: HTMLButtonElement;
}

interface Stage {
  caption: string;
  duration: number;
  camFrom: [number, number, number];
  camTo: [number, number, number];
  lookFrom: [number, number, number];
  lookTo: [number, number, number];
  rocketFrom: [number, number, number];
  rocketTo: [number, number, number];
}

const STAGES: Stage[] = [
  {
    caption: "Leaving Earth",
    duration: 3000,
    camFrom: [0, 1.5, 4.5],
    camTo: [0, 2.5, 6],
    lookFrom: [0, 1, 0],
    lookTo: [0, 2, 0],
    rocketFrom: [0, 1.1, 0],
    rocketTo: [0, 2.2, 0],
  },
  {
    caption: "Out into space",
    duration: 3000,
    camFrom: [0, 2.5, 6],
    camTo: [0, 6, 24],
    lookFrom: [0, 2, 0],
    lookTo: [0, 3, 0],
    rocketFrom: [0, 2.2, 0],
    rocketTo: [0, 6, 0],
  },
  {
    caption: "Past the solar system",
    duration: 3000,
    camFrom: [0, 6, 24],
    camTo: [0, 24, 90],
    lookFrom: [0, 3, 0],
    lookTo: [0, 30, -50],
    rocketFrom: [0, 6, 0],
    rocketTo: [0, 22, -25],
  },
  {
    caption: "Into empty space",
    duration: 2500,
    camFrom: [0, 24, 90],
    camTo: [0, 90, 340],
    lookFrom: [0, 30, -50],
    lookTo: [0, 40, -60],
    rocketFrom: [0, 22, -25],
    rocketTo: [0, 40, -60],
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

async function buildScene(
  THREE: typeof import("three"),
  canvas: HTMLCanvasElement,
): Promise<SceneController> {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 2000);
  const scene = new THREE.Scene();

  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(1, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0x3a6ea5 }),
  );
  scene.add(earth);

  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(1.08, 24, 16),
    new THREE.MeshBasicMaterial({
      color: 0x8ab4ff,
      transparent: true,
      opacity: 0.25,
      side: THREE.BackSide,
    }),
  );
  scene.add(atmosphere);

  const rocket = new THREE.Group();
  const rocketBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 0.6, 8),
    new THREE.MeshBasicMaterial({ color: 0xd8dce6 }),
  );
  const rocketNose = new THREE.Mesh(
    new THREE.ConeGeometry(0.12, 0.3, 8),
    new THREE.MeshBasicMaterial({ color: 0xeaf6ff }),
  );
  rocketNose.position.y = 0.45;
  rocket.add(rocketBody, rocketNose);
  scene.add(rocket);

  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(4, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xffcc66 }),
  );
  sun.position.set(0, 40, -60);
  scene.add(sun);

  const planetLayout: Array<{ radius: number; color: number; offset: [number, number, number] }> = [
    { radius: 0.6, color: 0xd9a066, offset: [8, 3, 6] },
    { radius: 1.0, color: 0x6fae67, offset: [-11, -4, 8] },
    { radius: 0.8, color: 0xb3543a, offset: [5, -7, -10] },
    { radius: 1.4, color: 0xdbb28a, offset: [-8, 8, -6] },
  ];
  for (const planet of planetLayout) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(planet.radius, 14, 10),
      new THREE.MeshBasicMaterial({ color: planet.color }),
    );
    mesh.position.set(
      sun.position.x + planet.offset[0],
      sun.position.y + planet.offset[1],
      sun.position.z + planet.offset[2],
    );
    scene.add(mesh);
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

  function renderPose(stageIndex: number, t: number): void {
    const stage = STAGES[stageIndex] ?? STAGES[STAGES.length - 1];
    const eased = easeInOutCubic(t);

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
    rocket.position.set(
      lerp(stage.rocketFrom[0], stage.rocketTo[0], eased),
      lerp(stage.rocketFrom[1], stage.rocketTo[1], eased),
      lerp(stage.rocketFrom[2], stage.rocketTo[2], eased),
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

interface ActiveSequence {
  refs: LaunchRefs;
  groundTimeouts: number[];
  raf: number | null;
  scene: SceneController | null;
  sceneLoading: Promise<SceneController> | null;
  resizeListener: (() => void) | null;
  finished: boolean;
}

let active: ActiveSequence | null = null;

function clearGroundTimeouts(sequence: ActiveSequence): void {
  for (const id of sequence.groundTimeouts) window.clearTimeout(id);
  sequence.groundTimeouts = [];
}

function resetGroundLayer(refs: LaunchRefs): void {
  refs.ground.hidden = false;
  refs.ground.classList.remove("is-fading");
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

  sequence.sceneLoading = (async () => {
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
  return sequence.sceneLoading;
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
  const scene = await ensureScene(sequence);
  if (active !== sequence) return;
  scene.renderPose(0, 0);
  sequence.refs.canvas.classList.add("is-visible");
  sequence.refs.ground.classList.add("is-fading");
  const hideGround = window.setTimeout(() => {
    sequence.refs.ground.hidden = true;
  }, 800);
  sequence.groundTimeouts.push(hideGround);
  runSpaceCutscene(sequence, scene);
}

function playGroundSequence(sequence: ActiveSequence): void {
  const { ground } = sequence.refs;
  const twinGo = ground.querySelector(".launch-twin-go");
  const rocket = ground.querySelector(".launch-rocket");

  twinGo?.classList.add("is-walking");
  const board = window.setTimeout(() => {
    twinGo?.classList.remove("is-walking");
    twinGo?.classList.add("is-boarding");
    rocket?.classList.add("is-igniting");
  }, GROUND_WALK_MS);

  const liftoff = window.setTimeout(() => {
    rocket?.classList.add("is-lifting");
  }, GROUND_WALK_MS + GROUND_BOARD_MS);

  const crossfade = window.setTimeout(
    () => {
      void crossFadeIntoScene(sequence);
    },
    GROUND_WALK_MS + GROUND_BOARD_MS + GROUND_LIFTOFF_MS - CROSSFADE_LEAD_MS,
  );

  sequence.groundTimeouts.push(board, liftoff, crossfade);
}

export function startLaunchSequence(refs: LaunchRefs): void {
  if (active) stopLaunchSequence();

  const sequence: ActiveSequence = {
    refs,
    groundTimeouts: [],
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
    void ensureScene(sequence).then((scene) => {
      if (active !== sequence) return;
      refs.canvas.classList.add("is-visible");
      scene.renderPose(STAGES.length - 1, 1);
      refs.caption.textContent = STAGES[STAGES.length - 1].caption;
      finishSequence(sequence);
    });
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

  void ensureScene(sequence).then((scene) => {
    if (active !== sequence) return;
    scene.renderPose(STAGES.length - 1, 1);
    sequence.refs.caption.textContent = STAGES[STAGES.length - 1].caption;
    finishSequence(sequence);
  });
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

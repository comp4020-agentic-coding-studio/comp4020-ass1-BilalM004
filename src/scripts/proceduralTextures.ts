// Textures for surfaces that have no real photograph to draw on -- the
// rocket is a fictional craft and a corona/glow halo isn't a photographed
// surface, so both stay procedurally generated rather than sourced as real
// texture images (unlike the planets/sun, see launchScene.ts).
export function makeMetalTexture(THREE: typeof import("three")): InstanceType<typeof THREE.CanvasTexture> {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
  gradient.addColorStop(0, "#9096a6");
  gradient.addColorStop(0.35, "#e4e8f2");
  gradient.addColorStop(0.55, "#c3c8d6");
  gradient.addColorStop(1, "#868c9c");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "rgba(40, 44, 56, 0.4)";
  ctx.lineWidth = 1;
  for (const y of [canvas.height * 0.32, canvas.height * 0.68]) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 3);
  return texture;
}

// Solar System Scope's Saturn ring texture is a flat inner->outer alpha
// strip (meant for a purpose-built ring UV unwrap), not an image already
// shaped like a ring -- resample one scanline of it radially onto a square
// canvas so it can be applied to a flat PlaneGeometry as a normal 2D
// texture (RingGeometry's default UVs aren't radial, so a plane is simpler).
export function makeRingTextureFromStrip(
  THREE: typeof import("three"),
  strip: HTMLImageElement,
  size = 256,
): InstanceType<typeof THREE.CanvasTexture> {
  const sampleCanvas = document.createElement("canvas");
  sampleCanvas.width = strip.width;
  sampleCanvas.height = strip.height;
  const sampleCtx = sampleCanvas.getContext("2d")!;
  sampleCtx.drawImage(strip, 0, 0);
  const row = Math.floor(strip.height / 2);
  const data = sampleCtx.getImageData(0, row, strip.width, 1).data;

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size / 2;
  for (let r = 0; r < maxR; r += 1) {
    const sx = Math.floor((r / maxR) * (strip.width - 1));
    const px = sx * 4;
    const alpha = data[px + 3] / 255;
    if (alpha < 0.03) continue;
    ctx.strokeStyle = `rgba(${data[px]}, ${data[px + 1]}, ${data[px + 2]}, ${alpha})`;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  return new THREE.CanvasTexture(canvas);
}

export function makeGlowTexture(THREE: typeof import("three")): InstanceType<typeof THREE.CanvasTexture> {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, "rgba(255, 244, 214, 0.9)");
  gradient.addColorStop(0.4, "rgba(255, 200, 120, 0.35)");
  gradient.addColorStop(1, "rgba(255, 160, 60, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return new THREE.CanvasTexture(canvas);
}

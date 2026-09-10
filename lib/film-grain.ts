const TILE = 384;
const FRAMES = 12;

/** Locked look: Stärke 25%, Größe 36%. */
export const DEFAULT_GRAIN_AMOUNT = 0.25;
export const DEFAULT_GRAIN_SIZE = 0.36;

function clampGrainSize(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_GRAIN_SIZE;
  return Math.min(1, Math.max(0.01, value));
}

/** Speck size in pixels. 1% ≈ 1px, 5% ≈ 1.1px, 100% ≈ 7px. */
function speckPxFromSize(size: number) {
  return 1 + Math.pow(clampGrainSize(size), 1.35) * 6;
}

const tileCache = new Map<number, (Uint8ClampedArray | undefined)[]>();

function gauss(rng: () => number) {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function noiseField(
  size: number,
  seed: number,
  spread: number,
  chroma = 10,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return canvas;
  const rng = mulberry32(seed);
  const pixels = ctx.createImageData(size, size);
  const data = pixels.data;
  for (let i = 0; i < data.length; i += 4) {
    const n = 128 + gauss(rng) * spread;
    const cr = gauss(rng) * chroma;
    const cb = gauss(rng) * chroma * 1.35;
    data[i] = n + cr;
    data[i + 1] = n - cr * 0.25;
    data[i + 2] = n + cb;
    data[i + 3] = 255;
  }
  ctx.putImageData(pixels, 0, 0);
  return canvas;
}

function makeTile(seed: number, speckPx: number): Uint8ClampedArray {
  const empty = new Uint8ClampedArray(TILE * TILE * 4);
  const canvas = document.createElement("canvas");
  canvas.width = TILE;
  canvas.height = TILE;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return empty;

  const field = Math.max(48, Math.round(TILE / speckPx));

  ctx.fillStyle = "rgb(128,128,128)";
  ctx.fillRect(0, 0, TILE, TILE);
  ctx.imageSmoothingEnabled = false;

  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.drawImage(noiseField(field, seed, 52, 9), 0, 0, TILE, TILE);

  const fine = Math.min(TILE, Math.round(field * 1.85));
  ctx.globalCompositeOperation = "soft-light";
  ctx.globalAlpha = 0.55;
  ctx.drawImage(noiseField(fine, seed + 17, 38, 6), 0, 0, TILE, TILE);

  ctx.globalCompositeOperation = "overlay";
  ctx.globalAlpha = 0.22;
  ctx.drawImage(noiseField(fine, seed + 31, 26, 4), 0, 0, TILE, TILE);

  return ctx.getImageData(0, 0, TILE, TILE).data;
}

function sizeBucket(size: number) {
  return Math.round(clampGrainSize(size) * 25);
}

function grainTile(size: number, frame: number): Uint8ClampedArray {
  const bucket = sizeBucket(size);
  let frames = tileCache.get(bucket);
  if (!frames) {
    frames = Array.from({ length: FRAMES });
    tileCache.set(bucket, frames);
    if (tileCache.size > 6) {
      const oldest = tileCache.keys().next().value;
      if (oldest !== undefined && oldest !== bucket) tileCache.delete(oldest);
    }
  }
  const existing = frames[frame];
  if (existing) return existing;
  const speckPx = speckPxFromSize(bucket / 25);
  const next = makeTile(0x9e3779b9 + frame * 101, speckPx);
  frames[frame] = next;
  return next;
}

function clampByte(value: number) {
  return value < 0 ? 0 : value > 255 ? 255 : value;
}

/**
 * Perceived grain vs tone (display-referred).
 * Midtones carry the stock look (4L(1−L)). Shadows get extra isolated-crystal
 * grain. Crushed black and paper white fade out.
 */
function grainToneEnvelope(luma: number) {
  const mid = 4 * luma * (1 - luma);
  const t =
    luma <= 0.015 ? 0 : luma >= 0.18 ? 1 : (luma - 0.015) / 0.165;
  const rise = t * t * (3 - 2 * t);
  const inv = 1 - luma;
  const shadow = 2.1 * inv * inv * rise;
  return mid * 0.58 + (shadow > 1 ? 1 : shadow) * 0.42;
}

/**
 * Density-aware grain. Soft-light/overlay of mid-gray is a Photoshop hack:
 * it contrast-punches everything the same and pulls saturated plate colors
 * toward gray. Real grain is the emulsion — multiplicative in density, per
 * dye layer, stronger in midtones/thin shadows, gone at D-min / D-max.
 */
export function overlayFilmGrain(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  timeS = 0,
) {
  const useAmount = DEFAULT_GRAIN_AMOUNT;
  const useSize = DEFAULT_GRAIN_SIZE;
  if (width <= 0 || height <= 0 || useAmount <= 0) return;
  const frame = Math.abs(Math.floor(timeS * 24)) % FRAMES;
  const grain = grainTile(useSize, frame);
  const ox = (frame * 73) % TILE;
  const oy = (frame * 131) % TILE;
  const dest = ctx.getImageData(0, 0, width, height);
  const px = dest.data;
  const amp0 = useAmount * 0.4;

  for (let y = 0; y < height; y++) {
    const gy = ((y + oy) % TILE) * TILE;
    for (let x = 0; x < width; x++) {
      const di = (y * width + x) << 2;
      const r = px[di];
      const g = px[di + 1];
      const b = px[di + 2];
      const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) * (1 / 255);
      const env = grainToneEnvelope(luma);
      if (env < 0.004) continue;

      const gi = (gy + ((x + ox) % TILE)) << 2;
      const gR = (grain[gi] - 128) * (1 / 128);
      const gG = (grain[gi + 1] - 128) * (1 / 128);
      const gB = (grain[gi + 2] - 128) * (1 / 128);
      const gL = 0.2126 * gR + 0.7152 * gG + 0.0722 * gB;
      const amp = amp0 * env;
      // Luma tick, then rescale RGB — visible on dark saturated blues,
      // without the gray milk that overlay/soft-light adds.
      const lumaY = luma * 255;
      const scale = lumaY > 1.5 ? (lumaY + gL * amp * 36) / lumaY : 1;
      const c = amp * 12;
      px[di] = clampByte(r * scale + (gR - gL) * c);
      px[di + 1] = clampByte(g * scale + (gG - gL) * c * 0.78);
      px[di + 2] = clampByte(b * scale + (gB - gL) * c * 1.28);
    }
  }

  ctx.putImageData(dest, 0, 0);
}

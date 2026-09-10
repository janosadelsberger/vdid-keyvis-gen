import type { BitmapSource } from "@/lib/image-edit";
import { WDC_SIDEBAR_WIDTH } from "@/lib/wdc-theme";

/** WDC plate is an 8-column light field. */
export const WDC_STRIPE_COUNT = 8;

const edgeCache = new WeakMap<object, number[]>();

export function sourceSize(img: BitmapSource): { w: number; h: number } {
  const video = img as HTMLVideoElement;
  if (typeof video.videoWidth === "number" && video.videoWidth > 0) {
    return { w: video.videoWidth, h: video.videoHeight };
  }
  return {
    w: img.naturalWidth || img.width || 0,
    h: img.naturalHeight || img.height || 0,
  };
}

export function equalStripeEdges(
  width: number,
  count = WDC_STRIPE_COUNT,
): number[] {
  return Array.from({ length: count + 1 }, (_, i) => (i * width) / count);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export function inferStripeEdges(width: number, rawEdges: number[]): number[] {
  const fallback = equalStripeEdges(width);
  const interior = rawEdges
    .filter((x) => x > 8 && x < width - 8)
    .sort((a, b) => a - b);
  if (interior.length < 3) return fallback;

  const points = [0, ...interior, width];
  const spacings: number[] = [];
  for (let i = 1; i < points.length; i++) {
    spacings.push(points[i] - points[i - 1]);
  }
  const period = median(spacings);
  if (period < 16) return fallback;
  const count = Math.round(width / period);
  if (count < 2 || count > 24) return fallback;
  // Keep measured lines when the plate is the 8-column WDC field.
  // A perfect grid is 2–6px off the real gradients and misses the banner snap.
  if (Math.abs(count - WDC_STRIPE_COUNT) <= 1) {
    const merged = [...points];
    for (const edge of fallback) {
      if (merged.every((point) => Math.abs(point - edge) > period * 0.35)) {
        merged.push(edge);
      }
    }
    return merged.sort((a, b) => a - b);
  }
  return equalStripeEdges(width, count);
}

export function detectVerticalStripeEdges(img: BitmapSource): number[] {
  const cached = edgeCache.get(img);
  if (cached) return cached;

  const { w: iw, h: ih } = sourceSize(img);
  if (iw < 16 || ih < 1) return equalStripeEdges(Math.max(iw, 1));

  let edges = equalStripeEdges(iw);
  if (typeof document !== "undefined") {
    try {
      const probe = document.createElement("canvas");
      probe.width = iw;
      probe.height = 1;
      const ctx = probe.getContext("2d", { willReadFrequently: true });
      if (ctx) {
        const band = Math.max(1, Math.floor(ih * 0.4));
        const y0 = Math.floor((ih - band) / 2);
        ctx.drawImage(img, 0, y0, iw, band, 0, 0, iw, 1);
        const data = ctx.getImageData(0, 0, iw, 1).data;
        const lum: number[] = [];
        for (let x = 0; x < iw; x++) {
          const i = x * 4;
          lum.push(
            0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2],
          );
        }
        const deriv = lum.map((v, x) => (x === 0 ? 0 : v - lum[x - 1]));
        const peak = Math.max(...deriv.map((v) => Math.abs(v)), 0);
        const thr = peak * 0.18;
        const raw: number[] = [];
        for (let x = 1; x < iw - 1; ) {
          const mag = Math.abs(deriv[x]);
          if (
            mag >= thr &&
            mag >= Math.abs(deriv[x - 1]) &&
            mag >= Math.abs(deriv[x + 1])
          ) {
            raw.push(x);
            x += Math.max(6, Math.round(iw / 48));
          } else {
            x += 1;
          }
        }
        edges = inferStripeEdges(iw, raw);
      }
    } catch {
      /* keep 8-column fallback */
    }
  }

  edgeCache.set(img, edges);
  return edges;
}

export type StripeAlignFit = {
  extraZoom: number;
  focalX: number;
};

/**
 * Left-anchor the plate and zoom just enough that a stripe edge lands on
 * the WDC banner. The left of the image stays put; a cut stripe is cropped
 * away by stepping to the next vertical line.
 */
export function stripeAlignFit(
  iw: number,
  ih: number,
  canvasW: number,
  canvasH: number,
  edges: number[],
  sidebarLeftRatio = 1 - WDC_SIDEBAR_WIDTH,
): StripeAlignFit {
  const cover = Math.max(canvasW / iw, canvasH / ih);
  const bannerPx = Math.round(canvasW * sidebarLeftRatio);
  const designed = equalStripeEdges(iw);
  const lines = [...new Set([...designed, ...edges])]
    .filter((edge) => edge > 1 && edge < iw - 0.5)
    .sort((a, b) => a - b);

  let best = Number.POSITIVE_INFINITY;
  for (const edge of lines) {
    const scale = bannerPx / edge;
    if (scale < cover - 1e-6) continue;
    if (iw * scale < canvasW - 1e-3) continue;
    if (ih * scale < canvasH - 1e-3) continue;
    if (scale < best) best = scale;
  }
  if (!Number.isFinite(best)) best = cover;

  const drawW = iw * best;
  return {
    extraZoom: best / cover,
    // dx = canvasW/2 - focalX * drawW = 0  →  left edge stays on the canvas left
    focalX: canvasW / (2 * drawW),
  };
}

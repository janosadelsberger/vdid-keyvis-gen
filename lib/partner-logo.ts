import type { BitmapSource } from "@/lib/image-edit";

const whiteLayerCache = new WeakMap<BitmapSource, HTMLCanvasElement>();

function sourceSize(img: BitmapSource) {
  const width = img.naturalWidth || img.width;
  const height = img.naturalHeight || img.height;
  return { width, height };
}

function whiteOverlayLayer(img: BitmapSource): HTMLCanvasElement | null {
  const cached = whiteLayerCache.get(img);
  if (cached) return cached;
  const { width, height } = sourceSize(img);
  if (width <= 0 || height <= 0) return null;
  const layer = document.createElement("canvas");
  layer.width = width;
  layer.height = height;
  const ctx = layer.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, width, height);
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  whiteLayerCache.set(img, layer);
  return layer;
}

/** Contain-fit a partner logo. Optional white overlay uses the PNG alpha as a mask. */
export function drawPartnerLogoInBox(
  ctx: CanvasRenderingContext2D,
  img: BitmapSource,
  box: { x: number; y: number; w: number; h: number },
  options?: { whiteOverlay?: boolean },
) {
  const { width: iw, height: ih } = sourceSize(img);
  if (iw <= 0 || ih <= 0 || box.w <= 0 || box.h <= 0) return;
  const scale = Math.min(box.w / iw, box.h / ih);
  const drawW = iw * scale;
  const drawH = ih * scale;
  const dx = box.x + (box.w - drawW) / 2;
  const dy = box.y + (box.h - drawH) / 2;
  const source = options?.whiteOverlay ? whiteOverlayLayer(img) : img;
  if (!source) return;
  ctx.drawImage(source, dx, dy, drawW, drawH);
}

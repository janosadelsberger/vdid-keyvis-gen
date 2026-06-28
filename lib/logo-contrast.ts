/** sRGB relative luminance (WCAG 2.x). */
export function relativeLuminance(r: number, g: number, b: number): number {
  const linear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

export type LogoVariant = "light" | "dark";

/** Light = white logo on dark backgrounds; dark = dark logo on light backgrounds. */
export function pickLogoVariant(averageLuminance: number): LogoVariant {
  return averageLuminance > 0.45 ? "dark" : "light";
}

/** Average luminance of opaque pixels in a canvas region (call after background is drawn). */
export function sampleRegionAverageLuminance(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): number {
  const canvas = ctx.canvas;
  const ix = Math.max(0, Math.floor(x));
  const iy = Math.max(0, Math.floor(y));
  const iw = Math.min(Math.max(1, Math.ceil(w)), canvas.width - ix);
  const ih = Math.min(Math.max(1, Math.ceil(h)), canvas.height - iy);
  if (iw <= 0 || ih <= 0) return 0;

  const { data } = ctx.getImageData(ix, iy, iw, ih);
  let sum = 0;
  let count = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    sum += relativeLuminance(data[i], data[i + 1], data[i + 2]);
    count += 1;
  }
  return count > 0 ? sum / count : 0;
}

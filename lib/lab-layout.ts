import type { NormalizedBox } from "@/lib/custom-template";

/** Horizontal / vertical inset used by every prebuilt lab slide. */
export const LAB_MARGIN_RATIO = 0.08;

/** Short-side reference for scale (matches 1080-wide export formats). */
export const LAB_REF_PX = 1080;

/**
 * VDID lockup SVG is `viewBox="0 0 200 200"`. Always treat the logo as square —
 * never trust `naturalWidth`/`naturalHeight` (those can be 0 or non-square
 * while the image is loading or after a style switch, which recenters the mark).
 */
export const VDID_LOGO_VIEWBOX_PX = 200;

/** White mark square in the lockup SVG (top-left of the 200×200 viewBox). */
export const VDID_LOGO_MARK_SQUARE_PX = 100;

/** Logo height as a fraction of canvas height, before the pixel cap. */
export const LAB_LOGO_HEIGHT_RATIO = 0.135;

/** Max logo edge in px at scale 1 (short side = 1080). */
export const LAB_LOGO_CAP_AT_REF = 142;

/** Type sizes at scale 1 — shared by prebuilt slides and editable presets. */
export const LAB_TYPE = {
  formatLabel: 30,
  titleHeading: 90,
  titleDate: 40,
  eventHeading: 72,
  eventDate: 34,
  presenter: 30,
  quoteHeading: 76,
  quoteBody: 56,
  attributionName: 30,
  attributionRole: 26,
  ctaHeading: 88,
  ctaBody: 52,
  ctaContact: 30,
  freeformBody: 38,
} as const;

export type LabLayout = {
  width: number;
  height: number;
  scale: number;
  marginX: number;
  marginY: number;
  contentWidth: number;
  /** Square edge of the VDID lockup in pixels. */
  logoSize: number;
  logoX: number;
  logoY: number;
};

export function getLabLayout(width: number, height: number): LabLayout {
  const scale = Math.min(width, height) / LAB_REF_PX;
  const marginX = width * LAB_MARGIN_RATIO;
  const marginY = height * LAB_MARGIN_RATIO;
  const logoSize = Math.min(
    height * LAB_LOGO_HEIGHT_RATIO,
    LAB_LOGO_CAP_AT_REF * scale,
  );
  return {
    width,
    height,
    scale,
    marginX,
    marginY,
    contentWidth: width - marginX * 2,
    logoSize,
    logoX: marginX,
    logoY: height - marginY - logoSize,
  };
}

/** Normalized box for the prebuilt bottom-left VDID logo (square in pixels). */
export function labLogoNormalizedBox(baseAspect: number): NormalizedBox {
  const width = LAB_REF_PX;
  const height = width / Math.max(0.01, baseAspect);
  const layout = getLabLayout(width, height);
  return {
    x: layout.logoX / width,
    y: layout.logoY / height,
    w: layout.logoSize / width,
    h: layout.logoSize / height,
  };
}

/**
 * Force a normalized box to be square in pixels, keeping the bottom-left
 * corner (same anchor the prebuilt slides use).
 *
 * `canvasAspect` is width / height.
 */
export function squareBoxInPixels(
  box: NormalizedBox,
  canvasAspect: number,
): NormalizedBox {
  const aspect = Math.max(0.01, canvasAspect);
  const w = Math.min(box.w, box.h / aspect);
  const h = w * aspect;
  return {
    x: box.x,
    y: box.y + box.h - h,
    w,
    h,
  };
}

/**
 * Resize a logo box while keeping it square in pixels. Uses the larger of the
 * proposed width/height so the SE handle can grow in either direction.
 */
export function resizeSquareLogoBox(
  proposed: NormalizedBox,
  canvasAspect: number,
): NormalizedBox {
  const aspect = Math.max(0.01, canvasAspect);
  const sizeFromW = proposed.w;
  const sizeFromH = proposed.h / aspect;
  let w = Math.max(0.02, Math.max(sizeFromW, sizeFromH));
  w = Math.min(1 - proposed.x, w);
  let h = w * aspect;
  if (proposed.y + h > 1) {
    h = Math.max(0.02, 1 - proposed.y);
    w = Math.min(w, h / aspect);
    h = w * aspect;
  }
  return { x: proposed.x, y: proposed.y, w, h };
}

export function squareLogoElements<T extends { kind: string; box: NormalizedBox }>(
  elements: T[],
  canvasAspect: number,
): T[] {
  return elements.map((el) =>
    el.kind === "logo"
      ? { ...el, box: squareBoxInPixels(el.box, canvasAspect) }
      : el,
  );
}

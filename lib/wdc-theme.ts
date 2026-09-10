import {
  VDID_LOGO_MARK_SQUARE_PX,
  VDID_LOGO_VIEWBOX_PX,
} from "@/lib/lab-layout";

/** World Design Capital / Designforum canvas chrome. */

export const WDC_BLUE = "#0A2CD9";
export const WDC_TEXT = "#FFFFFF";
export const WDC_SIDEBAR_FILL = "#FFFFFF";

export const WDC_BG_FILE = "/wdc-bg.png";
export const WDC_SIDEBAR_FILE = "/WDC2026_C_Print_CMYK_DINlang_hoch_Weiß.png";
export const WDC_VIDEO_CANDIDATES = [
  "/wdc-bg.mp4",
  "/wdc-bg.webm",
  "/wdc-bg.mov",
] as const;

/** Right-hand WDC strip as a fraction of canvas width. */
export const WDC_SIDEBAR_WIDTH = 0.11;

/** Logo edge as a fraction of the canvas short side. */
export const WDC_LOGO_SIZE_RATIO = 0.15;

const MARK_RATIO = VDID_LOGO_MARK_SQUARE_PX / VDID_LOGO_VIEWBOX_PX;

/** Left edge of the lockup — same x as the white mark square. */
export const WDC_MARGIN = WDC_LOGO_SIZE_RATIO * MARK_RATIO;
export const WDC_CONTENT_RIGHT = 1 - WDC_SIDEBAR_WIDTH - 0.035;
export const WDC_CONTENT_WIDTH = WDC_CONTENT_RIGHT - WDC_MARGIN;

export const WDC_LOGO_BOX = {
  x: WDC_MARGIN,
  y: 0.04,
  w: WDC_LOGO_SIZE_RATIO,
  h: WDC_LOGO_SIZE_RATIO,
} as const;

/** LinkedIn 1:1 and Instagram grid 4:5 — not Story. */
export function isWdcFeedGridCanvas(width: number, height: number) {
  if (width <= 0 || height <= 0) return false;
  const aspect = width / height;
  return Math.abs(aspect - 1) < 0.02 || Math.abs(aspect - 1080 / 1350) < 0.02;
}

/**
 * Pixel box for the VDID lockup: top-left inset is exactly one white mark
 * square (the 100×100 tile in the lockup), same on X and Y.
 */
export function wdcFeedGridLogoBox(
  width: number,
  height: number,
): { x: number; y: number; w: number; h: number } {
  const logoSize = Math.min(width, height) * WDC_LOGO_SIZE_RATIO;
  const inset = logoSize * MARK_RATIO;
  return { x: inset, y: inset, w: logoSize, h: logoSize };
}

export const WDC_SIDEBAR_BOX = {
  x: 1 - WDC_SIDEBAR_WIDTH,
  y: 0,
  w: WDC_SIDEBAR_WIDTH,
  h: 1,
} as const;

export const WDC_STORAGE_KEY = "vdid-wdc-deck-v1";

export const WDC_PLATE_MODES = ["animated", "still", "closeup"] as const;
export type WdcPlateMode = (typeof WDC_PLATE_MODES)[number];

export const WDC_DEFAULT_PLATE_MODE: WdcPlateMode = "animated";

/** Extra cover scale for the close-up still. */
export const WDC_CLOSEUP_ZOOM = 2.15;

export const WDC_PLATE_MODE_LABELS: Record<WdcPlateMode, string> = {
  animated: "Animiert",
  still: "Still der Animation",
  closeup: "Close-up",
};

export function parseWdcPlateMode(raw: unknown): WdcPlateMode {
  if (raw === "still" || raw === "closeup" || raw === "animated") return raw;
  return WDC_DEFAULT_PLATE_MODE;
}

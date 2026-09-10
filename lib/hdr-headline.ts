import {
  drawRichText,
  measureRichTextHeight,
  type DrawRichTextOptions,
} from "@/lib/canvas-richtext";
import { paintHdrHeadlinePassesWebgpu } from "@/lib/hdr-headline-gpu";

export const HDR_HEADLINE_STORAGE_KEY = "vdid-hdr-headline-v1";
export const DEFAULT_HDR_HEADLINE_AMOUNT = 0.4;

export type HdrHeadlinePref = {
  enabled: boolean;
  amount: number;
};

export type HdrEncoding = "hlg" | "pq" | "linear" | "p3-extended";

export type HdrCanvasProfile = {
  encoding: HdrEncoding;
  colorSpace: string;
  colorType: string;
  settings: HdrContext2DSettings;
};

export type HdrHeadlinePass = {
  text: string;
  options: DrawRichTextOptions;
  amount: number;
};

export type HdrCanvasSupport = {
  profile: HdrCanvasProfile | null;
  displayHdr: boolean;
  webgpu: boolean;
};

type Canvas2dHost = HTMLCanvasElement | OffscreenCanvas;

export type HdrContext2DSettings = Omit<
  CanvasRenderingContext2DSettings,
  "colorSpace"
> & {
  colorSpace?: string;
  colorType?: string;
  pixelFormat?: string;
  toneMapping?: { mode: string };
};

type ContextAttrs = CanvasRenderingContext2DSettings & {
  colorType?: string;
  pixelFormat?: string;
  toneMapping?: { mode?: string };
};

const contextPasses = new WeakMap<CanvasRenderingContext2D, HdrHeadlinePass[]>();
const contextProfiles = new WeakMap<CanvasRenderingContext2D, HdrCanvasProfile>();
let framePasses: HdrHeadlinePass[] | null = null;

const HDR_PROFILE_CANDIDATES: Array<{
  encoding: HdrEncoding;
  settings: HdrContext2DSettings;
}> = [
  {
    encoding: "hlg",
    settings: {
      colorSpace: "rec2100-hlg",
      colorType: "float16",
      toneMapping: { mode: "extended" },
    },
  },
  {
    encoding: "hlg",
    settings: {
      colorSpace: "rec2100-hlg",
      colorType: "float16",
    },
  },
  {
    encoding: "hlg",
    settings: {
      colorSpace: "rec2100-hlg",
      pixelFormat: "float16",
    },
  },
  {
    encoding: "hlg",
    settings: {
      colorSpace: "rec2100-hlg",
    },
  },
  {
    encoding: "pq",
    settings: {
      colorSpace: "rec2100-pq",
      colorType: "float16",
      toneMapping: { mode: "extended" },
    },
  },
  {
    encoding: "pq",
    settings: {
      colorSpace: "rec2100-pq",
      colorType: "float16",
    },
  },
  {
    encoding: "linear",
    settings: {
      colorSpace: "rec2100-linear",
      colorType: "float16",
      toneMapping: { mode: "extended" },
    },
  },
  {
    encoding: "linear",
    settings: {
      colorSpace: "rec2100-display-linear",
      colorType: "float16",
      toneMapping: { mode: "extended" },
    },
  },
  {
    encoding: "linear",
    settings: {
      colorSpace: "display-p3-linear",
      colorType: "float16",
      toneMapping: { mode: "extended" },
    },
  },
  {
    encoding: "linear",
    settings: {
      colorSpace: "srgb-linear",
      colorType: "float16",
      toneMapping: { mode: "extended" },
    },
  },
  {
    encoding: "p3-extended",
    settings: {
      colorSpace: "display-p3",
      colorType: "float16",
      toneMapping: { mode: "extended" },
    },
  },
  {
    encoding: "p3-extended",
    settings: {
      colorSpace: "display-p3",
      pixelFormat: "float16",
      toneMapping: { mode: "extended" },
    },
  },
  {
    encoding: "p3-extended",
    settings: {
      colorSpace: "srgb",
      colorType: "float16",
      toneMapping: { mode: "extended" },
    },
  },
];

let cachedProfile: HdrCanvasProfile | null | undefined;

export function clampHdrAmount(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_HDR_HEADLINE_AMOUNT;
  return Math.min(1, Math.max(0, value));
}

export function displaySupportsHdr(): boolean {
  if (typeof matchMedia === "undefined") return false;
  return (
    matchMedia("(dynamic-range: high)").matches ||
    matchMedia("(video-dynamic-range: high)").matches
  );
}

export function loadHdrHeadlinePref(): HdrHeadlinePref {
  const fallback: HdrHeadlinePref = {
    enabled: false,
    amount: DEFAULT_HDR_HEADLINE_AMOUNT,
  };
  if (typeof localStorage === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(HDR_HEADLINE_STORAGE_KEY);
    if (!raw || raw === "0") return fallback;
    if (raw === "1") return { enabled: true, amount: DEFAULT_HDR_HEADLINE_AMOUNT };
    const parsed = JSON.parse(raw) as Partial<HdrHeadlinePref>;
    return {
      enabled: !!parsed.enabled,
      amount: clampHdrAmount(
        parsed.amount ?? DEFAULT_HDR_HEADLINE_AMOUNT,
      ),
    };
  } catch {
    return fallback;
  }
}

export function saveHdrHeadlinePref(pref: HdrHeadlinePref) {
  try {
    localStorage.setItem(
      HDR_HEADLINE_STORAGE_KEY,
      JSON.stringify({
        enabled: pref.enabled,
        amount: clampHdrAmount(pref.amount),
      }),
    );
  } catch {
    /* ignore */
  }
}

function readContextAttrs(
  ctx: CanvasRenderingContext2D,
): ContextAttrs | undefined {
  return ctx.getContextAttributes?.() as ContextAttrs | undefined;
}

function colorTypeOf(attrs: ContextAttrs | undefined) {
  if (!attrs) return "";
  return String(attrs.colorType || attrs.pixelFormat || "");
}

function classifyHdrAttributes(
  attrs: ContextAttrs | undefined,
): HdrEncoding | null {
  if (!attrs) return null;
  const space = String(attrs.colorSpace ?? "");
  const float = colorTypeOf(attrs) === "float16";

  if (space === "rec2100-hlg") return "hlg";
  if (space === "rec2100-pq") return "pq";
  if (
    (space === "rec2100-linear" || space === "rec2100-display-linear") &&
    float
  ) {
    return "linear";
  }
  if (
    (space === "display-p3-linear" || space === "srgb-linear") &&
    float
  ) {
    return "linear";
  }
  if (
    (space === "display-p3" || space === "srgb" || space === "rec2020") &&
    float
  ) {
    return "p3-extended";
  }
  return null;
}

export function contextIsHdr(ctx: CanvasRenderingContext2D): boolean {
  return classifyHdrAttributes(readContextAttrs(ctx)) != null;
}

function configureCanvasHdr(canvas: Canvas2dHost) {
  const host = canvas as HTMLCanvasElement & {
    configureHighDynamicRange?: (options: { mode: string }) => void;
  };
  try {
    host.configureHighDynamicRange?.({ mode: "extended" });
  } catch {
    /* unsupported */
  }
  if ("style" in canvas && canvas.style) {
    canvas.style.setProperty("dynamic-range", "high");
    canvas.style.setProperty("dynamic-range-limit", "no-limit");
  }
}

function tryHdrContext(
  canvas: Canvas2dHost,
  settings: HdrContext2DSettings,
  willReadFrequently?: boolean,
): CanvasRenderingContext2D | null {
  configureCanvasHdr(canvas);
  try {
    return canvas.getContext("2d", {
      ...settings,
      willReadFrequently,
    } as CanvasRenderingContext2DSettings) as CanvasRenderingContext2D | null;
  } catch {
    return null;
  }
}

export function probeHdrCanvasProfile(): HdrCanvasProfile | null {
  if (cachedProfile !== undefined) return cachedProfile;
  if (typeof document === "undefined") return null;

  for (const candidate of HDR_PROFILE_CANDIDATES) {
    const probe = document.createElement("canvas");
    probe.width = 2;
    probe.height = 2;
    const ctx = tryHdrContext(probe, candidate.settings);
    if (!ctx) continue;
    const attrs = readContextAttrs(ctx);
    const encoding = classifyHdrAttributes(attrs);
    if (!encoding) continue;
    const colorSpace = String(attrs?.colorSpace ?? candidate.settings.colorSpace);
    const profile: HdrCanvasProfile = {
      encoding,
      colorSpace,
      colorType: colorTypeOf(attrs) || "unorm8",
      settings: candidate.settings,
    };
    if (!canPaintHdrColor(ctx, profile)) continue;
    cachedProfile = profile;
    return cachedProfile;
  }

  cachedProfile = null;
  return null;
}

export function describeHdrCanvasSupport(): HdrCanvasSupport {
  return {
    profile: probeHdrCanvasProfile(),
    displayHdr: displaySupportsHdr(),
    webgpu:
      typeof navigator !== "undefined" &&
      !!(navigator as Navigator & { gpu?: unknown }).gpu,
  };
}

export function hdrSupportHint(info: HdrCanvasSupport): string {
  if (info.profile) {
    const type =
      info.profile.colorType === "float16"
        ? "float16"
        : info.profile.colorType;
    const base = `Canvas-Profil: ${info.profile.colorSpace} · ${type}. PNG/JPEG bleiben SDR.`;
    if (!info.displayHdr) {
      return `${base} Dieser Bildschirm meldet kein HDR — der Effekt erscheint nur auf einem HDR-Monitor.`;
    }
    return base;
  }
  if (info.webgpu) {
    return "Kein 2D-HDR-Profil (rec2100/float16). Fallback: WebGPU rgba16float mit extended Tone-Mapping. PNG/JPEG bleiben SDR.";
  }
  return "Dieses Fenster kann kein HDR-Canvas öffnen (rec2100/float16). Der Titel bleibt SDR-Weiß.";
}

export function get2dContext(
  canvas: Canvas2dHost,
  opts?: { hdr?: boolean; hdrOnly?: boolean; willReadFrequently?: boolean },
): CanvasRenderingContext2D | null {
  if (opts?.hdr) {
    const profile = probeHdrCanvasProfile();
    if (profile) {
      const hdrCtx = tryHdrContext(
        canvas,
        profile.settings,
        opts.willReadFrequently,
      );
      if (hdrCtx && contextIsHdr(hdrCtx)) {
        contextProfiles.set(hdrCtx, {
          ...profile,
          colorSpace: String(
            readContextAttrs(hdrCtx)?.colorSpace ?? profile.colorSpace,
          ),
          colorType: colorTypeOf(readContextAttrs(hdrCtx)) || profile.colorType,
        });
        return hdrCtx;
      }
    }
    if (opts.hdrOnly) return null;
  }
  return canvas.getContext(
    "2d",
    opts?.willReadFrequently ? { willReadFrequently: true } : undefined,
  ) as CanvasRenderingContext2D | null;
}

function profileForContext(
  ctx: CanvasRenderingContext2D,
): HdrCanvasProfile | null {
  const stored = contextProfiles.get(ctx);
  if (stored) return stored;
  const attrs = readContextAttrs(ctx);
  const encoding = classifyHdrAttributes(attrs);
  if (!encoding || !attrs) return null;
  return {
    encoding,
    colorSpace: String(attrs.colorSpace ?? "srgb"),
    colorType: colorTypeOf(attrs) || "unorm8",
    settings: {
      colorSpace: attrs.colorSpace,
      colorType: attrs.colorType,
      pixelFormat: attrs.pixelFormat,
      toneMapping: attrs.toneMapping?.mode
        ? { mode: attrs.toneMapping.mode }
        : undefined,
    },
  };
}

function cssColor(
  space: string,
  value: number,
  alpha = 1,
) {
  const v = Number(value.toFixed(4));
  return alpha < 1
    ? `color(${space} ${v} ${v} ${v} / ${alpha})`
    : `color(${space} ${v} ${v} ${v})`;
}

/** Map 0–1 highlight lift into the canvas color space. 0 = SDR white. */
export function hdrLumaCss(
  profile: HdrCanvasProfile,
  lift: number,
  alpha = 1,
): string {
  const t = Math.min(1, Math.max(0, lift));
  switch (profile.encoding) {
    case "hlg":
      // BT.2408: SDR / reference white is HLG 0.75; 1.0 is peak.
      return cssColor(profile.colorSpace, 0.75 + 0.25 * t, alpha);
    case "pq":
      // 203 nits ≈ 0.58, ~1000 nits ≈ 0.75.
      return cssColor(profile.colorSpace, 0.58 + 0.17 * t, alpha);
    case "linear":
      return cssColor(profile.colorSpace, 1 + 0.55 * t, alpha);
    default:
      return cssColor(
        profile.colorSpace === "srgb" ? "srgb" : "display-p3",
        1 + 0.45 * t,
        alpha,
      );
  }
}

function canPaintHdrColor(
  ctx: CanvasRenderingContext2D,
  profile: HdrCanvasProfile,
): boolean {
  try {
    const peak = hdrLumaCss(profile, 1);
    ctx.fillStyle = peak;
    const gradient = ctx.createLinearGradient(0, 0, 1, 0);
    gradient.addColorStop(0, peak);
    gradient.addColorStop(1, hdrLumaCss(profile, 0));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1, 1);
    return true;
  } catch {
    return false;
  }
}

function addMapStops(
  gradient: CanvasGradient,
  kind: "linear" | "spot",
  amount: number,
  profile: HdrCanvasProfile,
) {
  if (kind === "linear") {
    gradient.addColorStop(0, hdrLumaCss(profile, 0.18 * amount));
    gradient.addColorStop(0.42, hdrLumaCss(profile, 0.7 * amount));
    gradient.addColorStop(1, hdrLumaCss(profile, 0.28 * amount));
    return;
  }
  gradient.addColorStop(0, hdrLumaCss(profile, amount));
  gradient.addColorStop(1, hdrLumaCss(profile, 0.08 * amount));
}

function measureHeadlineHeight(
  ctx: CanvasRenderingContext2D,
  text: string,
  options: DrawRichTextOptions,
) {
  const { fontSize, maxWidth, lineHeight = fontSize * 1.25 } = options;
  return measureRichTextHeight(
    ctx,
    text,
    maxWidth,
    fontSize,
    options.fontWeight,
    lineHeight,
    options.fontFamily,
  );
}

function blitHeadlinePass(
  dest: CanvasRenderingContext2D,
  text: string,
  options: DrawRichTextOptions,
  amount: number,
  profile: HdrCanvasProfile,
) {
  const { fontSize, maxWidth, textAlign } = options;
  const height = measureRichTextHeight(
    dest,
    text,
    maxWidth,
    fontSize,
    options.fontWeight,
    options.lineHeight ?? fontSize * 1.25,
    options.fontFamily,
  );
  if (height <= 0) return;

  const pad = 2;
  const layer = document.createElement("canvas");
  layer.width = Math.max(1, Math.ceil(maxWidth + pad * 2));
  layer.height = Math.max(1, Math.ceil(height + pad * 2));
  const layerCtx = get2dContext(layer, { hdr: true, hdrOnly: true });
  if (!layerCtx) {
    paintHeadlineMap(dest, text, options, amount, profile);
    return;
  }

  paintHeadlineMap(
    layerCtx,
    text,
    {
      ...options,
      x: pad,
      y: pad,
      textAlign: "left",
    },
    amount,
    profile,
  );

  const dx =
    textAlign === "right" ? options.x - maxWidth - pad : options.x - pad;
  dest.save();
  dest.globalCompositeOperation = "source-over";
  dest.drawImage(layer, dx, options.y - pad);
  dest.restore();
}

function paintHeadlineMap(
  ctx: CanvasRenderingContext2D,
  text: string,
  options: DrawRichTextOptions,
  amount: number,
  profile: HdrCanvasProfile,
) {
  const { x, y, maxWidth, fontSize, lineHeight = fontSize * 1.25 } = options;
  const height = measureRichTextHeight(
    ctx,
    text,
    maxWidth,
    fontSize,
    options.fontWeight,
    lineHeight,
    options.fontFamily,
  );
  if (height <= 0) return;

  ctx.save();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  drawRichText(ctx, text, {
    ...options,
    baseColor: hdrLumaCss(profile, Math.max(0.22, 0.6 * amount)),
    highlightColor: hdrLumaCss(profile, amount),
  });

  try {
    const linear = ctx.createLinearGradient(x, y, x + maxWidth, y + height);
    addMapStops(linear, "linear", amount, profile);
    ctx.globalCompositeOperation = "source-atop";
    ctx.fillStyle = linear;
    ctx.fillRect(x - 1, y - 1, maxWidth + 2, height + 2);

    const radius = Math.max(maxWidth, height) * 0.7;
    const spot = ctx.createRadialGradient(
      x + maxWidth * 0.28,
      y + height * 0.22,
      0,
      x + maxWidth * 0.28,
      y + height * 0.22,
      radius,
    );
    addMapStops(spot, "spot", amount, profile);
    ctx.fillStyle = spot;
    ctx.fillRect(x - 1, y - 1, maxWidth + 2, height + 2);
  } catch {
    /* solid HDR glyphs are enough if the gradient map is rejected */
  }
  ctx.restore();
}

function rememberPass(
  ctx: CanvasRenderingContext2D,
  pass: HdrHeadlinePass,
) {
  if (framePasses) {
    framePasses.push(pass);
    return;
  }
  const list = contextPasses.get(ctx);
  if (list) list.push(pass);
  else contextPasses.set(ctx, [pass]);
}

export function beginHdrHeadlineCollection() {
  framePasses = [];
}

export function consumeHdrHeadlinePasses(
  ctx: CanvasRenderingContext2D,
): HdrHeadlinePass[] {
  if (framePasses) {
    const collected = framePasses;
    framePasses = null;
    return collected;
  }
  const list = contextPasses.get(ctx) ?? [];
  contextPasses.delete(ctx);
  return list;
}

/** Overlay a subtle HDR luminance map so headline glyphs can go slightly above SDR white. */
export function overlayHeadlineHdrMap(
  ctx: CanvasRenderingContext2D,
  text: string,
  options: DrawRichTextOptions,
  amount = DEFAULT_HDR_HEADLINE_AMOUNT,
): void {
  if (!text.trim()) return;
  const strength = clampHdrAmount(amount);
  if (strength <= 0) return;
  const height = measureHeadlineHeight(ctx, text, options);
  if (height <= 0) return;

  const profile = profileForContext(ctx);
  if (profile) {
    try {
      blitHeadlinePass(ctx, text, options, strength, profile);
    } catch {
      /* keep the SDR headline underneath */
    }
    return;
  }

  rememberPass(ctx, { text, options: { ...options }, amount: strength });
}

function paintHdrHeadlinePasses2d(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  passes: HdrHeadlinePass[],
  profile: HdrCanvasProfile,
): boolean {
  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);
  const ctx = get2dContext(canvas, { hdr: true, hdrOnly: true });
  if (!ctx || !contextIsHdr(ctx)) return false;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const pass of passes) {
    try {
      paintHeadlineMap(ctx, pass.text, pass.options, pass.amount, profile);
    } catch {
      /* skip this pass */
    }
  }
  return true;
}

export async function paintHdrHeadlinePasses(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  passes: HdrHeadlinePass[],
): Promise<"2d" | "webgpu" | "none"> {
  if (passes.length === 0) return "none";

  const profile = probeHdrCanvasProfile();
  if (profile) {
    return paintHdrHeadlinePasses2d(canvas, width, height, passes, profile)
      ? "2d"
      : "none";
  }

  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);
  const painted = await paintHdrHeadlinePassesWebgpu(canvas, passes);
  return painted ? "webgpu" : "none";
}

import { overlayHeadlineHdrMap } from "@/lib/hdr-headline";
import {
  drawRichText,
  FIT_TEXT_GROW_RATIO,
  FIT_TEXT_MIN_RATIO,
  fitRichTextFontSize,
  measureRichTextHeight,
} from "@/lib/canvas-richtext";
import {
  DEFAULT_IMAGE_EDIT_SETTINGS,
  type ImageEditSettings,
  drawEditedImageCover,
} from "@/lib/image-edit";
import {
  defaultContentForTemplate,
  type CustomSlideImageSlot,
  type CustomTemplate,
} from "@/lib/custom-template";
import { renderCustomTemplateToContext } from "@/lib/custom-template-render";
import type { WdcPlateMode } from "@/lib/wdc-theme";
import { drawPartnerLogoInBox } from "@/lib/partner-logo";
import { getLabLayout, LAB_TYPE } from "@/lib/lab-layout";
import {
  FONT,
  LAB_BAND,
  LAB_BG,
  LAB_BLUE,
  LAB_MUTED,
  LAB_TEXT,
} from "@/lib/lab-theme";

export type { ImageEditSettings };
export {
  FONT,
  LAB_BAND,
  LAB_BG,
  LAB_BLUE,
  LAB_MUTED,
  LAB_TEXT,
} from "@/lib/lab-theme";

export type SlideType =
  | "title"
  | "quote"
  | "cta"
  | "eventPhoto"
  | "fullImage"
  | "coBranded"
  | "freeform"
  | "custom";

export type LabSlide = {
  id: string;
  type: SlideType;
  formatLabel?: string;
  heading?: string;
  body?: string;
  dateLine?: string;
  name?: string;
  role?: string;
  contact?: string;
  imageUrl?: string | null;
  partnerLogoUrl?: string | null;
  /** Paint the partner PNG alpha as white (Lab Co-Branding). */
  partnerLogoWhiteOverlay?: boolean;
  imageEdits?: ImageEditSettings;
  /** WDC plate: looping video, matching still, or the provided close-up PNG. */
  plateMode?: WdcPlateMode;
  /** Custom template slide */
  customTemplateId?: string;
  fields?: Record<string, string>;
  images?: Record<string, CustomSlideImageSlot>;
};

/** Minimal image shape shared by the DOM (`HTMLImageElement`) and node-canvas. */
export type RenderImage = CanvasImageSource & {
  naturalWidth?: number;
  naturalHeight?: number;
  width: number;
  height: number;
};

export type LabLogoStyle = "color" | "bw";

export type RenderAssets = {
  /** User preference: color (rgb) or black-and-white (sw) for light backgrounds. */
  logoStyle: LabLogoStyle;
  /** Primary logo for light backgrounds — rgb or sw per {@link logoStyle}. */
  logo: RenderImage;
  /** White / negative logo for dark backgrounds (full-image auto contrast). */
  logoWhite?: RenderImage | null;
  slideImages: Map<string, RenderImage>;
  partnerLogos: Map<string, RenderImage>;
  customTemplates?: Map<string, CustomTemplate>;
  /** Public chrome plates keyed by `publicFile` path (e.g. `/wdc-bg.png`). */
  bundledImages?: Map<string, RenderImage>;
  /** Optional looping video plate; when ready, replaces the still background. */
  backgroundVideo?: HTMLVideoElement | null;
  /** When set, headline text gets an HDR sheen map (glow on HDR displays). */
  hdrHeadline?: boolean;
  /** 0–1 strength of the HDR “whiter than white” map. */
  hdrHeadlineAmount?: number;
};

export function primaryLogoForStyle(
  style: LabLogoStyle,
  logos: { rgb: RenderImage; bw: RenderImage },
): RenderImage {
  return style === "color" ? logos.rgb : logos.bw;
}

/** Luminance threshold: below → white logo, above → dark logo. */
const LOGO_REGION_LUMINANCE_THRESHOLD = 0.45;

export type SlideDims = {
  width: number;
  height: number;
  topUiSafeInsetRatio?: number;
};

type Ctx = CanvasRenderingContext2D;

type LayoutMetrics = {
  width: number;
  height: number;
  marginX: number;
  marginY: number;
  contentWidth: number;
  logoHeight: number;
  logoWidth: number;
  topSafe: number;
  scale: number;
};

function getLayout(
  width: number,
  height: number,
  topUiSafeInsetRatio?: number,
): LayoutMetrics {
  const lab = getLabLayout(width, height);
  const topSafe =
    topUiSafeInsetRatio != null && topUiSafeInsetRatio > 0
      ? height * topUiSafeInsetRatio
      : 0;

  return {
    width,
    height,
    marginX: lab.marginX,
    marginY: lab.marginY,
    contentWidth: lab.contentWidth,
    logoHeight: lab.logoSize,
    logoWidth: lab.logoSize,
    topSafe,
    scale: lab.scale,
  };
}

/**
 * Draw the full VDID logo lockup (SVG as-is, only recolored via {@link loadRecoloredLogo}).
 */
function logoRegion(layout: LayoutMetrics) {
  return {
    x: layout.marginX,
    y: layout.height - layout.marginY - layout.logoHeight,
    w: layout.logoWidth,
    h: layout.logoHeight,
  };
}

function drawLogo(ctx: Ctx, logo: RenderImage, layout: LayoutMetrics) {
  const { x, y, w, h } = logoRegion(layout);
  ctx.drawImage(logo, x, y, w, h);
}

/**
 * Sample average relative luminance (0–1) from a canvas region.
 * Falls back to 1 (light) if pixels are unreadable (e.g. tainted canvas).
 */
function sampleCanvasLuminance(
  ctx: Ctx,
  region: { x: number; y: number; w: number; h: number },
): number | null {
  const ix = Math.max(0, Math.floor(region.x));
  const iy = Math.max(0, Math.floor(region.y));
  const iw = Math.min(Math.ceil(region.w), ctx.canvas.width - ix);
  const ih = Math.min(Math.ceil(region.h), ctx.canvas.height - iy);
  if (iw <= 0 || ih <= 0) return null;

  let data: ImageData;
  try {
    data = ctx.getImageData(ix, iy, iw, ih);
  } catch {
    return null;
  }

  const step = Math.max(1, Math.floor(Math.min(iw, ih) / 10));
  let sum = 0;
  let count = 0;
  for (let py = 0; py < ih; py += step) {
    for (let px = 0; px < iw; px += step) {
      const i = (py * iw + px) * 4;
      const r = data.data[i];
      const g = data.data[i + 1];
      const b = data.data[i + 2];
      sum += (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      count++;
    }
  }
  return count > 0 ? sum / count : null;
}

function pickLogoForRegion(
  ctx: Ctx,
  layout: LayoutMetrics,
  logoDark: RenderImage,
  logoWhite: RenderImage | null | undefined,
): RenderImage {
  const luminance = sampleCanvasLuminance(ctx, logoRegion(layout));
  if (
    luminance != null &&
    luminance < LOGO_REGION_LUMINANCE_THRESHOLD &&
    logoWhite
  ) {
    return logoWhite;
  }
  return logoDark;
}

function drawFormatLabel(
  ctx: Ctx,
  text: string,
  layout: LayoutMetrics,
  y: number,
  fontSize: number,
): number {
  if (!text.trim()) return y;
  const parts = text.split(/(VDID)/);
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  let cx = layout.marginX;
  for (const part of parts) {
    if (!part) continue;
    const isBrand = part === "VDID";
    ctx.font = `${isBrand ? "700" : "400"} ${fontSize}px ${FONT}`;
    ctx.fillStyle = isBrand ? LAB_TEXT : LAB_MUTED;
    ctx.fillText(part, cx, y);
    cx += ctx.measureText(part).width;
  }
  return y + fontSize * 1.4;
}

function drawSlideImage(
  ctx: Ctx,
  img: RenderImage,
  x: number,
  y: number,
  w: number,
  h: number,
  edits?: ImageEditSettings,
) {
  drawEditedImageCover(
    ctx,
    img,
    x,
    y,
    w,
    h,
    edits ?? DEFAULT_IMAGE_EDIT_SETTINGS,
  );
}

function drawImagePlaceholder(
  ctx: Ctx,
  layout: LayoutMetrics,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  ctx.fillStyle = "#D8D8D8";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "#8A8A8A";
  ctx.font = `400 ${24 * layout.scale}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Foto hochladen", x + w / 2, y + h / 2);
}

/** Bottom-right name (bold) + role (regular) block, baseline-aligned to the logo. */
function drawAttribution(
  ctx: Ctx,
  name: string,
  role: string,
  layout: LayoutMetrics,
) {
  if (!name.trim() && !role.trim()) return;
  const nameSize = LAB_TYPE.attributionName * layout.scale;
  const roleSize = LAB_TYPE.attributionRole * layout.scale;
  const right = layout.width - layout.marginX;
  // Align the block so its baseline sits roughly with the logo's vertical center.
  let y = layout.height - layout.marginY - layout.logoHeight * 0.25;

  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";

  if (role.trim()) {
    ctx.font = `400 ${roleSize}px ${FONT}`;
    ctx.fillStyle = LAB_TEXT;
    ctx.fillText(role, right, y);
    y -= roleSize * 1.4;
  }

  if (name.trim()) {
    ctx.font = `700 ${nameSize}px ${FONT}`;
    ctx.fillStyle = LAB_TEXT;
    ctx.fillText(name, right, y);
  }
}

type FittedRichTextStyle = {
  maxFontSize: number;
  minFontSize?: number;
  fontWeight?: string;
  lineHeightRatio?: number;
  baseColor?: string;
  highlightColor?: string;
  growRatio?: number;
  hdrMap?: boolean;
  hdrAmount?: number;
};

function drawFittedRichText(
  ctx: Ctx,
  text: string,
  layout: LayoutMetrics,
  y: number,
  maxHeight: number,
  style: FittedRichTextStyle,
): { height: number; fontSize: number } {
  if (!text.trim() || maxHeight <= 0) {
    return { height: 0, fontSize: style.maxFontSize };
  }

  const lineHeightRatio = style.lineHeightRatio ?? 1.25;
  const fontSize = fitRichTextFontSize(ctx, text, {
    maxWidth: layout.contentWidth,
    maxHeight,
    maxFontSize: style.maxFontSize,
    minFontSize: style.minFontSize ?? style.maxFontSize * FIT_TEXT_MIN_RATIO,
    fontWeight: style.fontWeight ?? "400",
    lineHeightRatio,
    fontFamily: FONT,
    growRatio: style.growRatio ?? FIT_TEXT_GROW_RATIO,
  });
  const lineHeight = fontSize * lineHeightRatio;

  const drawOpts = {
    x: layout.marginX,
    y,
    maxWidth: layout.contentWidth,
    fontSize,
    fontWeight: style.fontWeight ?? "400",
    lineHeight,
    baseColor: style.baseColor ?? LAB_TEXT,
    highlightColor: style.highlightColor ?? LAB_BLUE,
    fontFamily: FONT,
  };
  drawRichText(ctx, text, drawOpts);
  if (style.hdrMap && (style.hdrAmount ?? 0) > 0) {
    overlayHeadlineHdrMap(ctx, text, drawOpts, style.hdrAmount);
  }

  return {
    height: measureRichTextHeight(
      ctx,
      text,
      layout.contentWidth,
      fontSize,
      style.fontWeight ?? "400",
      lineHeight,
      FONT,
    ),
    fontSize,
  };
}

function contentBottomY(layout: LayoutMetrics, footerReserve: number): number {
  return layout.height - layout.marginY - footerReserve;
}

/**
 * Header block shared by event-style slides: format label, big heading, date line.
 * Returns the y just below the date line (start of the image area).
 */
function drawEventHeader(
  ctx: Ctx,
  slide: LabSlide,
  layout: LayoutMetrics,
  opts: {
    labelSize: number;
    headingSize: number;
    dateSize: number;
    maxBottomY?: number;
    hdrMap?: boolean;
    hdrAmount?: number;
  },
): number {
  let y = layout.marginY + layout.topSafe;

  y = drawFormatLabel(ctx, slide.formatLabel ?? "", layout, y, opts.labelSize);
  y += opts.labelSize * 0.5;

  if (slide.heading?.trim()) {
    const dateReserve = slide.dateLine?.trim()
      ? opts.dateSize * 1.7 + opts.headingSize * 0.28
      : opts.headingSize * 0.28;
    const maxBottom =
      opts.maxBottomY ?? layout.height - layout.marginY - layout.logoHeight;
    const maxHeadingHeight = Math.max(
      opts.headingSize * FIT_TEXT_MIN_RATIO,
      maxBottom - y - dateReserve,
    );

    const fitted = drawFittedRichText(
      ctx,
      slide.heading,
      layout,
      y,
      maxHeadingHeight,
      {
        maxFontSize: opts.headingSize,
        fontWeight: "700",
        lineHeightRatio: 1.08,
        growRatio: 1.75,
        hdrMap: opts.hdrMap,
        hdrAmount: opts.hdrAmount,
      },
    );
    y += fitted.height + fitted.fontSize * 0.28;
  }

  if (slide.dateLine?.trim()) {
    ctx.font = `400 ${opts.dateSize}px ${FONT}`;
    ctx.fillStyle = LAB_TEXT;
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    ctx.fillText(slide.dateLine, layout.marginX, y);
    y += opts.dateSize * 1.7;
  }

  return y;
}

function drawTitleSlide(
  ctx: Ctx,
  slide: LabSlide,
  layout: LayoutMetrics,
  logo: RenderImage,
  hdrMap?: boolean,
  hdrAmount?: number,
) {
  const maxBottomY =
    layout.height - layout.marginY - layout.logoHeight - layout.marginY * 0.15;
  drawEventHeader(ctx, slide, layout, {
    labelSize: LAB_TYPE.formatLabel * layout.scale,
    headingSize: LAB_TYPE.titleHeading * layout.scale,
    dateSize: LAB_TYPE.titleDate * layout.scale,
    maxBottomY,
    hdrMap,
    hdrAmount,
  });
  drawLogo(ctx, logo, layout);
}

function drawQuoteSlide(
  ctx: Ctx,
  slide: LabSlide,
  layout: LayoutMetrics,
  logo: RenderImage,
  hdrMap?: boolean,
  hdrAmount?: number,
) {
  const headingSize = LAB_TYPE.quoteHeading * layout.scale;
  const bodySize = LAB_TYPE.quoteBody * layout.scale;
  const attrReserve =
    slide.name?.trim() || slide.role?.trim() ? 72 * layout.scale : 0;
  const bottom = contentBottomY(layout, layout.logoHeight + attrReserve);
  let y = layout.marginY + layout.topSafe;
  let remaining = bottom - y;

  if (slide.heading?.trim()) {
    const maxHeadingHeight = Math.min(
      remaining * 0.45,
      headingSize * 1.1 * 4,
    );
    const fitted = drawFittedRichText(
      ctx,
      slide.heading,
      layout,
      y,
      Math.max(headingSize * FIT_TEXT_MIN_RATIO, maxHeadingHeight),
      {
        maxFontSize: headingSize,
        fontWeight: "700",
        lineHeightRatio: 1.1,
        growRatio: 1.7,
        hdrMap,
        hdrAmount,
      },
    );
    y += fitted.height + fitted.fontSize * 0.7;
    remaining = bottom - y;
  }

  if (slide.body?.trim() && remaining > bodySize * FIT_TEXT_MIN_RATIO) {
    drawFittedRichText(ctx, slide.body, layout, y, remaining, {
      maxFontSize: bodySize,
      lineHeightRatio: 1.3,
      growRatio: 1.5,
    });
  }

  drawAttribution(ctx, slide.name ?? "", slide.role ?? "", layout);
  drawLogo(ctx, logo, layout);
}

function drawCtaSlide(
  ctx: Ctx,
  slide: LabSlide,
  layout: LayoutMetrics,
  logo: RenderImage,
  hdrMap?: boolean,
  hdrAmount?: number,
) {
  const headingSize = LAB_TYPE.ctaHeading * layout.scale;
  const bodySize = LAB_TYPE.ctaBody * layout.scale;
  const contactSize = LAB_TYPE.ctaContact * layout.scale;
  const contactLines = slide.contact?.trim()
    ? slide.contact.split("\n").length
    : 0;
  const contactReserve =
    contactLines > 0
      ? contactLines * contactSize * 1.4 + layout.logoHeight * 0.35
      : 0;
  const bottom = contentBottomY(
    layout,
    layout.logoHeight + contactReserve + layout.marginY * 0.1,
  );
  let y = layout.marginY + layout.topSafe;
  let remaining = bottom - y;

  if (slide.heading?.trim()) {
    const maxHeadingHeight = Math.min(
      remaining * 0.5,
      headingSize * 1.1 * 3,
    );
    const fitted = drawFittedRichText(
      ctx,
      slide.heading,
      layout,
      y,
      Math.max(headingSize * FIT_TEXT_MIN_RATIO, maxHeadingHeight),
      {
        maxFontSize: headingSize,
        fontWeight: "700",
        lineHeightRatio: 1.1,
        baseColor: LAB_BLUE,
        highlightColor: LAB_BLUE,
        growRatio: 1.7,
        hdrMap,
        hdrAmount,
      },
    );
    y += fitted.height + fitted.fontSize * 0.7;
    remaining = bottom - y;
  }

  if (slide.body?.trim() && remaining > bodySize * FIT_TEXT_MIN_RATIO) {
    drawFittedRichText(ctx, slide.body, layout, y, remaining, {
      maxFontSize: bodySize,
      lineHeightRatio: 1.3,
      growRatio: 1.5,
    });
  }

  if (slide.contact?.trim()) {
    const lines = slide.contact.split("\n");
    const right = layout.width - layout.marginX;
    let cy = layout.height - layout.marginY - layout.logoHeight * 0.25;
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (!line) continue;
      const lineHeight = contactSize * 1.4;
      const blockH =
        measureRichTextHeight(
          ctx,
          line,
          layout.contentWidth,
          contactSize,
          "400",
          lineHeight,
          FONT,
        ) || lineHeight;
      drawRichText(ctx, line, {
        x: right,
        y: cy - blockH,
        maxWidth: layout.contentWidth,
        fontSize: contactSize,
        fontWeight: "400",
        lineHeight,
        baseColor: LAB_MUTED,
        highlightColor: LAB_BLUE,
        fontFamily: FONT,
        textAlign: "right",
      });
      cy -= lineHeight;
    }
  }

  drawLogo(ctx, logo, layout);
}

function drawEventPhotoSlide(
  ctx: Ctx,
  slide: LabSlide,
  layout: LayoutMetrics,
  logo: RenderImage,
  slideImage: RenderImage | null,
  hdrMap?: boolean,
  hdrAmount?: number,
) {
  const presenterSize = LAB_TYPE.presenter * layout.scale;
  const hasPresenter = !!slide.name?.trim();
  const footerReserve =
    layout.logoHeight +
    layout.marginY +
    (hasPresenter ? presenterSize * 1.4 : 0);
  const imageMinHeight = 40;
  const maxBottomY =
    layout.height - footerReserve - imageMinHeight - layout.scale * 8;

  const y = drawEventHeader(ctx, slide, layout, {
    labelSize: LAB_TYPE.formatLabel * layout.scale,
    headingSize: LAB_TYPE.eventHeading * layout.scale,
    dateSize: LAB_TYPE.eventDate * layout.scale,
    maxBottomY,
    hdrMap,
    hdrAmount,
  });
  const imageTop = y + layout.scale * 8;
  const imageH = layout.height - imageTop - footerReserve;
  const imageW = layout.contentWidth;

  if (imageH > 40) {
    if (slideImage) {
      drawSlideImage(
        ctx,
        slideImage,
        layout.marginX,
        imageTop,
        imageW,
        imageH,
        slide.imageEdits,
      );
    } else {
      drawImagePlaceholder(ctx, layout, layout.marginX, imageTop, imageW, imageH);
    }
  }

  if (hasPresenter) {
    ctx.font = `700 ${presenterSize}px ${FONT}`;
    ctx.fillStyle = LAB_TEXT;
    ctx.textAlign = "right";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(
      slide.name as string,
      layout.width - layout.marginX,
      layout.height - layout.marginY - layout.logoHeight * 0.25,
    );
  }

  drawLogo(ctx, logo, layout);
}

function drawCoBrandedSlide(
  ctx: Ctx,
  slide: LabSlide,
  layout: LayoutMetrics,
  logo: RenderImage,
  slideImage: RenderImage | null,
  partnerLogo: RenderImage | null,
  hdrMap?: boolean,
  hdrAmount?: number,
) {
  const footerReserve = layout.logoHeight + layout.marginY + 20 * layout.scale;
  const imageMinHeight = 40;
  const maxBottomY =
    layout.height - footerReserve - imageMinHeight - layout.scale * 8;

  const y = drawEventHeader(ctx, slide, layout, {
    labelSize: LAB_TYPE.formatLabel * layout.scale,
    headingSize: LAB_TYPE.eventHeading * layout.scale,
    dateSize: LAB_TYPE.eventDate * layout.scale,
    maxBottomY,
    hdrMap,
    hdrAmount,
  });

  const imageTop = y + layout.scale * 8;
  const imageH = layout.height - imageTop - footerReserve;
  const imageW = layout.contentWidth;

  if (imageH > 40) {
    if (slideImage) {
      drawSlideImage(
        ctx,
        slideImage,
        layout.marginX,
        imageTop,
        imageW,
        imageH,
        slide.imageEdits,
      );
    } else {
      drawImagePlaceholder(ctx, layout, layout.marginX, imageTop, imageW, imageH);
    }
  }

  drawLogo(ctx, logo, layout);

  if (partnerLogo) {
    const maxH = layout.logoHeight;
    const aspect =
      (partnerLogo.naturalWidth || partnerLogo.width) /
      (partnerLogo.naturalHeight || partnerLogo.height || 1);
    const pw = maxH * aspect;
    const px = layout.width - layout.marginX - pw;
    const py = layout.height - layout.marginY - maxH;
    drawPartnerLogoInBox(
      ctx,
      partnerLogo,
      { x: px, y: py, w: pw, h: maxH },
      { whiteOverlay: slide.partnerLogoWhiteOverlay },
    );
  }
}

function drawFreeformSlide(
  ctx: Ctx,
  slide: LabSlide,
  layout: LayoutMetrics,
  logo: RenderImage,
  slideImage: RenderImage | null,
  hdrMap?: boolean,
  hdrAmount?: number,
) {
  const labelSize = LAB_TYPE.formatLabel * layout.scale;
  const headingSize = LAB_TYPE.eventHeading * layout.scale;
  const bodySize = LAB_TYPE.freeformBody * layout.scale;
  const hasName = !!slide.name?.trim();
  const footerReserve =
    layout.logoHeight + layout.marginY + (hasName ? 40 * layout.scale : 0);
  const imageMinHeight = 60;
  const bottom = contentBottomY(layout, footerReserve + imageMinHeight);
  let y = layout.marginY + layout.topSafe;
  let remaining = bottom - y;

  if (slide.formatLabel?.trim()) {
    y = drawFormatLabel(ctx, slide.formatLabel, layout, y, labelSize);
    y += labelSize * 0.4;
    remaining = bottom - y;
  }

  if (slide.heading?.trim()) {
    const maxHeadingHeight = Math.min(
      remaining * 0.42,
      headingSize * 1.08 * 3,
    );
    const fitted = drawFittedRichText(
      ctx,
      slide.heading,
      layout,
      y,
      Math.max(headingSize * FIT_TEXT_MIN_RATIO, maxHeadingHeight),
      {
        maxFontSize: headingSize,
        fontWeight: "700",
        lineHeightRatio: 1.08,
        growRatio: 1.7,
        hdrMap,
        hdrAmount,
      },
    );
    y += fitted.height + bodySize * 0.3;
    remaining = bottom - y;
  }

  if (slide.body?.trim() && remaining > bodySize * FIT_TEXT_MIN_RATIO) {
    const fitted = drawFittedRichText(ctx, slide.body, layout, y, remaining, {
      maxFontSize: bodySize,
      lineHeightRatio: 1.3,
      growRatio: 1.5,
    });
    y += fitted.height + bodySize * 0.6;
  } else if (slide.body?.trim()) {
    y += bodySize * 0.6;
  }

  const imageTop = y;
  const imageH = layout.height - imageTop - footerReserve;
  if (imageH > 60) {
    if (slideImage) {
      drawSlideImage(
        ctx,
        slideImage,
        layout.marginX,
        imageTop,
        layout.contentWidth,
        imageH,
        slide.imageEdits,
      );
    } else {
      drawImagePlaceholder(
        ctx,
        layout,
        layout.marginX,
        imageTop,
        layout.contentWidth,
        imageH,
      );
    }
  }

  if (hasName) {
    ctx.font = `700 ${LAB_TYPE.presenter * layout.scale}px ${FONT}`;
    ctx.fillStyle = LAB_TEXT;
    ctx.textAlign = "right";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(
      slide.name as string,
      layout.width - layout.marginX,
      layout.height - layout.marginY - layout.logoHeight * 0.25,
    );
  }

  drawLogo(ctx, logo, layout);
}

function drawFullImageSlide(
  ctx: Ctx,
  slide: LabSlide,
  layout: LayoutMetrics,
  logoDark: RenderImage,
  logoWhite: RenderImage | null | undefined,
  slideImage: RenderImage | null,
) {
  const w = layout.width;
  const h = layout.height;

  if (slideImage) {
    drawSlideImage(ctx, slideImage, 0, 0, w, h, slide.imageEdits);
  } else {
    drawImagePlaceholder(ctx, layout, 0, 0, w, h);
  }

  const logo = pickLogoForRegion(ctx, layout, logoDark, logoWhite);
  drawLogo(ctx, logo, layout);
}

/** Render a slide onto an existing 2D context of the given pixel dimensions. */
export function renderLabSlideToContext(
  ctx: Ctx,
  slide: LabSlide,
  dims: SlideDims,
  assets: RenderAssets,
): void {
  const layout = getLayout(
    dims.width,
    dims.height,
    dims.topUiSafeInsetRatio,
  );

  const slideImage = slide.imageUrl
    ? assets.slideImages.get(slide.imageUrl) ?? null
    : null;
  const partnerLogo = slide.partnerLogoUrl
    ? assets.partnerLogos.get(slide.partnerLogoUrl) ?? null
    : null;

  if (slide.type !== "fullImage" && slide.type !== "custom") {
    ctx.fillStyle = LAB_BG;
    ctx.fillRect(0, 0, dims.width, dims.height);
  }

  switch (slide.type) {
    case "custom": {
      const templateId = slide.customTemplateId;
      const template = templateId
        ? assets.customTemplates?.get(templateId)
        : undefined;
      if (!template) {
        ctx.fillStyle = LAB_BG;
        ctx.fillRect(0, 0, dims.width, dims.height);
        ctx.fillStyle = LAB_MUTED;
        ctx.font = `400 ${32 * layout.scale}px ${FONT}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("Vorlage nicht gefunden", dims.width / 2, dims.height / 2);
        break;
      }
      const defaults = defaultContentForTemplate(template);
      const images = { ...defaults.images };
      for (const [slot, value] of Object.entries(slide.images ?? {})) {
        images[slot] = {
          ...defaults.images[slot],
          ...value,
          edits: value.edits ?? defaults.images[slot]?.edits,
        };
      }
      const content = {
        fields: { ...defaults.fields, ...slide.fields },
        images,
        plateEdits: slide.imageEdits,
        plateMode: slide.plateMode,
      };
      renderCustomTemplateToContext(ctx, template, content, dims, assets);
      break;
    }
    case "title":
      drawTitleSlide(
        ctx,
        slide,
        layout,
        assets.logo,
        assets.hdrHeadline,
        assets.hdrHeadlineAmount,
      );
      break;
    case "quote":
      drawQuoteSlide(
        ctx,
        slide,
        layout,
        assets.logo,
        assets.hdrHeadline,
        assets.hdrHeadlineAmount,
      );
      break;
    case "cta":
      drawCtaSlide(
        ctx,
        slide,
        layout,
        assets.logo,
        assets.hdrHeadline,
        assets.hdrHeadlineAmount,
      );
      break;
    case "eventPhoto":
      drawEventPhotoSlide(
        ctx,
        slide,
        layout,
        assets.logo,
        slideImage,
        assets.hdrHeadline,
        assets.hdrHeadlineAmount,
      );
      break;
    case "fullImage":
      drawFullImageSlide(
        ctx,
        slide,
        layout,
        assets.logo,
        assets.logoWhite,
        slideImage,
      );
      break;
    case "coBranded":
      drawCoBrandedSlide(
        ctx,
        slide,
        layout,
        assets.logo,
        slideImage,
        partnerLogo,
        assets.hdrHeadline,
        assets.hdrHeadlineAmount,
      );
      break;
    case "freeform":
      drawFreeformSlide(
        ctx,
        slide,
        layout,
        assets.logo,
        slideImage,
        assets.hdrHeadline,
        assets.hdrHeadlineAmount,
      );
      break;
  }
}

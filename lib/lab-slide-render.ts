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

export type { ImageEditSettings };

export type SlideType =
  | "title"
  | "quote"
  | "cta"
  | "eventPhoto"
  | "coBranded"
  | "freeform";

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
  imageEdits?: ImageEditSettings;
};

/** Minimal image shape shared by the DOM (`HTMLImageElement`) and node-canvas. */
export type RenderImage = CanvasImageSource & {
  naturalWidth?: number;
  naturalHeight?: number;
  width: number;
  height: number;
};

export type RenderAssets = {
  logo: RenderImage;
  slideImages: Map<string, RenderImage>;
  partnerLogos: Map<string, RenderImage>;
};

export type SlideDims = {
  width: number;
  height: number;
  topUiSafeInsetRatio?: number;
};

export const LAB_BG = "#F0F0F0";
export const LAB_TEXT = "#1A1A1A";
export const LAB_MUTED = "#5A5A5A";
export const LAB_BLUE = "#0A2CD9";
export const LAB_BAND = "#1A1A1A";
export const FONT = "Roboto, system-ui, sans-serif";

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
  logo: RenderImage,
  topUiSafeInsetRatio?: number,
): LayoutMetrics {
  const scale = Math.min(width, height) / 1080;
  const marginX = width * 0.08;
  const marginY = height * 0.08;
  const topSafe =
    topUiSafeInsetRatio != null && topUiSafeInsetRatio > 0
      ? height * topUiSafeInsetRatio
      : 0;
  const logoHeight = Math.min(height * 0.135, 142 * scale);
  const lnw = logo.naturalWidth || logo.width || 200;
  const lnh = logo.naturalHeight || logo.height || 200;
  const logoWidth = logoHeight * (lnw / lnh);

  return {
    width,
    height,
    marginX,
    marginY,
    contentWidth: width - marginX * 2,
    logoHeight,
    logoWidth,
    topSafe,
    scale,
  };
}

/**
 * Draw the full VDID logo lockup (SVG as-is, only recolored via {@link loadRecoloredLogo}).
 */
function drawLogo(ctx: Ctx, logo: RenderImage, layout: LayoutMetrics) {
  const x = layout.marginX;
  const y = layout.height - layout.marginY - layout.logoHeight;
  ctx.drawImage(logo, x, y, layout.logoWidth, layout.logoHeight);
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
  const nameSize = 30 * layout.scale;
  const roleSize = 26 * layout.scale;
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

  drawRichText(ctx, text, {
    x: layout.marginX,
    y,
    maxWidth: layout.contentWidth,
    fontSize,
    fontWeight: style.fontWeight ?? "400",
    lineHeight,
    baseColor: style.baseColor ?? LAB_TEXT,
    highlightColor: style.highlightColor ?? LAB_BLUE,
    fontFamily: FONT,
  });

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
) {
  const maxBottomY =
    layout.height - layout.marginY - layout.logoHeight - layout.marginY * 0.15;
  drawEventHeader(ctx, slide, layout, {
    labelSize: 30 * layout.scale,
    headingSize: 90 * layout.scale,
    dateSize: 40 * layout.scale,
    maxBottomY,
  });
  drawLogo(ctx, logo, layout);
}

function drawQuoteSlide(
  ctx: Ctx,
  slide: LabSlide,
  layout: LayoutMetrics,
  logo: RenderImage,
) {
  const headingSize = 76 * layout.scale;
  const bodySize = 56 * layout.scale;
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
) {
  const headingSize = 88 * layout.scale;
  const bodySize = 52 * layout.scale;
  const contactSize = 30 * layout.scale;
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
) {
  const presenterSize = 30 * layout.scale;
  const hasPresenter = !!slide.name?.trim();
  const footerReserve =
    layout.logoHeight +
    layout.marginY +
    (hasPresenter ? presenterSize * 1.4 : 0);
  const imageMinHeight = 40;
  const maxBottomY =
    layout.height - footerReserve - imageMinHeight - layout.scale * 8;

  const y = drawEventHeader(ctx, slide, layout, {
    labelSize: 30 * layout.scale,
    headingSize: 72 * layout.scale,
    dateSize: 34 * layout.scale,
    maxBottomY,
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
) {
  const footerReserve = layout.logoHeight + layout.marginY + 20 * layout.scale;
  const imageMinHeight = 40;
  const maxBottomY =
    layout.height - footerReserve - imageMinHeight - layout.scale * 8;

  const y = drawEventHeader(ctx, slide, layout, {
    labelSize: 30 * layout.scale,
    headingSize: 72 * layout.scale,
    dateSize: 34 * layout.scale,
    maxBottomY,
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
    ctx.drawImage(partnerLogo, px, py, pw, maxH);
  }
}

function drawFreeformSlide(
  ctx: Ctx,
  slide: LabSlide,
  layout: LayoutMetrics,
  logo: RenderImage,
  slideImage: RenderImage | null,
) {
  const labelSize = 30 * layout.scale;
  const headingSize = 72 * layout.scale;
  const bodySize = 38 * layout.scale;
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
    ctx.font = `700 ${30 * layout.scale}px ${FONT}`;
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

/** Render a slide onto an existing 2D context of the given pixel dimensions. */
export function renderLabSlideToContext(
  ctx: Ctx,
  slide: LabSlide,
  dims: SlideDims,
  assets: RenderAssets,
): void {
  ctx.fillStyle = LAB_BG;
  ctx.fillRect(0, 0, dims.width, dims.height);

  const layout = getLayout(
    dims.width,
    dims.height,
    assets.logo,
    dims.topUiSafeInsetRatio,
  );

  const slideImage = slide.imageUrl
    ? assets.slideImages.get(slide.imageUrl) ?? null
    : null;
  const partnerLogo = slide.partnerLogoUrl
    ? assets.partnerLogos.get(slide.partnerLogoUrl) ?? null
    : null;

  switch (slide.type) {
    case "title":
      drawTitleSlide(ctx, slide, layout, assets.logo);
      break;
    case "quote":
      drawQuoteSlide(ctx, slide, layout, assets.logo);
      break;
    case "cta":
      drawCtaSlide(ctx, slide, layout, assets.logo);
      break;
    case "eventPhoto":
      drawEventPhotoSlide(ctx, slide, layout, assets.logo, slideImage);
      break;
    case "coBranded":
      drawCoBrandedSlide(
        ctx,
        slide,
        layout,
        assets.logo,
        slideImage,
        partnerLogo,
      );
      break;
    case "freeform":
      drawFreeformSlide(ctx, slide, layout, assets.logo, slideImage);
      break;
  }
}

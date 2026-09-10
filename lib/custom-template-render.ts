import { overlayHeadlineHdrMap } from "@/lib/hdr-headline";
import {
  drawRichText,
  fitRichTextFontSize,
  FIT_TEXT_GROW_RATIO,
  FIT_TEXT_MIN_RATIO,
  measureLeftInkInset,
  measureRichTextHeight,
} from "@/lib/canvas-richtext";
import {
  DEFAULT_IMAGE_EDIT_SETTINGS,
  drawEditedImageCover,
  type ImageEditSettings,
} from "@/lib/image-edit";
import {
  pickLogoVariant,
  sampleRegionAverageLuminance,
} from "@/lib/logo-contrast";
import type {
  CustomSlideContent,
  CustomTemplate,
  NormalizedBox,
  OverlayFit,
  TemplateElement,
  TemplateOverlayAsset,
  TextTemplateElement,
} from "@/lib/custom-template";
import { boxToPixels } from "@/lib/custom-template";
import type { RenderAssets, RenderImage, SlideDims } from "@/lib/lab-slide-render";
import { FONT, LAB_BG, LAB_BLUE, LAB_MUTED, LAB_TEXT } from "@/lib/lab-theme";
import { drawPartnerLogoInBox } from "@/lib/partner-logo";
import {
  WDC_BG_FILE,
  WDC_MARGIN,
  isWdcFeedGridCanvas,
  parseWdcPlateMode,
  wdcFeedGridLogoBox,
} from "@/lib/wdc-theme";

type Ctx = CanvasRenderingContext2D;

function drawPlaceholder(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  scale: number,
) {
  ctx.fillStyle = "#D8D8D8";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "#8A8A8A";
  ctx.font = `400 ${24 * scale}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x + w / 2, y + h / 2);
}

function pickLogo(
  ctx: Ctx,
  variant: "auto" | "dark" | "white",
  box: { x: number; y: number; w: number; h: number },
  logoDark: RenderImage,
  logoWhite: RenderImage | null | undefined,
): RenderImage {
  if (variant === "dark") return logoDark;
  if (variant === "white" && logoWhite) return logoWhite;
  if (variant === "white") return logoDark;
  const lum = sampleRegionAverageLuminance(ctx, box.x, box.y, box.w, box.h);
  const v = pickLogoVariant(lum);
  return v === "light" && logoWhite ? logoWhite : logoDark;
}

/**
 * VDID lockup is a square (200×200 viewBox). Draw a square from the box's
 * bottom-left — never center-fit a rectangle, or the mark jumps when the
 * canvas aspect or decoded image size changes.
 */
function logoDrawRect(box: { x: number; y: number; w: number; h: number }) {
  const size = Math.min(box.w, box.h);
  return {
    x: box.x,
    y: box.y + box.h - size,
    w: size,
    h: size,
  };
}

function drawLogoInBox(
  ctx: Ctx,
  logo: RenderImage,
  box: { x: number; y: number; w: number; h: number },
) {
  const dest = logoDrawRect(box);
  ctx.drawImage(logo, dest.x, dest.y, dest.w, dest.h);
}

function sourceSize(img: RenderImage): { w: number; h: number } {
  const video = img as HTMLVideoElement;
  if (typeof video.videoWidth === "number" && video.videoWidth > 0) {
    return { w: video.videoWidth, h: video.videoHeight };
  }
  return {
    w: img.naturalWidth || img.width || 0,
    h: img.naturalHeight || img.height || 0,
  };
}

function drawFittedImage(
  ctx: Ctx,
  img: RenderImage,
  box: { x: number; y: number; w: number; h: number },
  fit: OverlayFit,
) {
  const { w: iw, h: ih } = sourceSize(img);
  if (iw <= 0 || ih <= 0 || box.w <= 0 || box.h <= 0) return;
  if (fit === "stretch") {
    ctx.drawImage(img, box.x, box.y, box.w, box.h);
    return;
  }
  const scale =
    fit === "cover"
      ? Math.max(box.w / iw, box.h / ih)
      : Math.min(box.w / iw, box.h / ih);
  const drawW = iw * scale;
  const drawH = ih * scale;
  const dx = box.x + (box.w - drawW) / 2;
  const dy = box.y + (box.h - drawH) / 2;
  ctx.save();
  ctx.beginPath();
  ctx.rect(box.x, box.y, box.w, box.h);
  ctx.clip();
  ctx.drawImage(img, dx, dy, drawW, drawH);
  ctx.restore();
}

function drawTemplatePlate(
  ctx: Ctx,
  template: CustomTemplate,
  dims: SlideDims,
  assets: RenderAssets,
  plateEdits?: ImageEditSettings,
  plateModeRaw?: CustomSlideContent["plateMode"],
) {
  ctx.fillStyle = template.backgroundColor || LAB_BG;
  ctx.fillRect(0, 0, dims.width, dims.height);

  const edits = plateEdits ?? DEFAULT_IMAGE_EDIT_SETTINGS;
  const plateMode = parseWdcPlateMode(plateModeRaw);
  const video = assets.backgroundVideo;
  const videoReady =
    plateMode !== "closeup" &&
    video &&
    video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
    video.videoWidth > 0;

  if (videoReady) {
    drawEditedImageCover(
      ctx,
      video,
      0,
      0,
      dims.width,
      dims.height,
      edits,
    );
  } else if (template.backgroundImageSrc) {
    const plate = assets.bundledImages?.get(template.backgroundImageSrc);
    if (plate) {
      drawEditedImageCover(
        ctx,
        plate,
        0,
        0,
        dims.width,
        dims.height,
        edits,
      );
    }
  }

  for (const overlay of template.overlayAssets ?? []) {
    drawOverlayAsset(ctx, overlay, dims, assets);
  }
}

function drawOverlayAsset(
  ctx: Ctx,
  overlay: TemplateOverlayAsset,
  dims: SlideDims,
  assets: RenderAssets,
) {
  const box = boxToPixels(overlay.box, dims.width, dims.height);
  if (overlay.backgroundFill) {
    ctx.fillStyle = overlay.backgroundFill;
    ctx.fillRect(box.x, box.y, box.w, box.h);
  }
  const img = assets.bundledImages?.get(overlay.src);
  if (!img) return;
  drawFittedImage(ctx, img, box, overlay.fit ?? "contain");
}

function isWdcLeftColumn(el: TemplateElement) {
  return el.kind === "text" && Math.abs(el.box.x - WDC_MARGIN) < 0.02;
}

function columnTextElements(template: CustomTemplate): TextTemplateElement[] {
  return template.elements.filter(
    (el): el is TextTemplateElement => el.kind === "text" && isWdcLeftColumn(el),
  );
}

function pinBoxToLogoLeft(
  el: TemplateElement,
  box: { x: number; y: number; w: number; h: number },
  logoBoxPx: { x: number; y: number; w: number; h: number } | null,
) {
  if (!logoBoxPx || !isWdcLeftColumn(el)) return box;
  const right = box.x + box.w;
  const x = logoBoxPx.x;
  return {
    ...box,
    x,
    w: el.kind === "text" ? Math.max(1, right - x) : box.w,
  };
}

function resolveElementText(
  el: TextTemplateElement,
  content: CustomSlideContent,
  sampleMode: boolean,
) {
  const text = sampleMode
    ? el.defaultText || el.label
    : (content.fields[el.field] ?? el.defaultText);
  return text.trim();
}

function textBoxMetrics(
  ctx: Ctx,
  el: TextTemplateElement,
  text: string,
  box: { x: number; y: number; w: number; h: number },
  canvasHeight: number,
) {
  const fontSizeBase = el.style.heightFraction * canvasHeight;
  const fontSize = el.style.autoFit
    ? fitRichTextFontSize(ctx, text, {
        maxWidth: box.w,
        maxHeight: box.h,
        maxFontSize: fontSizeBase,
        minFontSize: fontSizeBase * FIT_TEXT_MIN_RATIO,
        fontWeight: el.style.fontWeight,
        lineHeightRatio: el.style.lineHeightRatio,
        fontFamily: FONT,
        growRatio: FIT_TEXT_GROW_RATIO,
      })
    : fontSizeBase;
  const lineHeight = fontSize * el.style.lineHeightRatio;
  const height = measureRichTextHeight(
    ctx,
    text,
    box.w,
    fontSize,
    el.style.fontWeight,
    lineHeight,
    FONT,
  );
  return { fontSize, lineHeight, height };
}

/** Shift so the gap under the logo equals the gap above the bottom edge. */
function wdcTextColumnYShift(
  ctx: Ctx,
  template: CustomTemplate,
  content: CustomSlideContent,
  dims: SlideDims,
  logoBoxPx: { x: number; y: number; w: number; h: number } | null,
  sampleMode: boolean,
) {
  if (!logoBoxPx) return 0;
  const els = columnTextElements(template);
  if (els.length === 0) return 0;
  if (Math.min(...els.map((el) => el.box.y)) > 0.5) return 0;

  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const el of els) {
    const text = resolveElementText(el, content, sampleMode);
    if (!text) continue;
    const box = pinBoxToLogoLeft(
      el,
      boxToPixels(el.box, dims.width, dims.height),
      logoBoxPx,
    );
    const metrics = textBoxMetrics(ctx, el, text, box, dims.height);
    minY = Math.min(minY, box.y);
    maxY = Math.max(maxY, box.y + Math.max(metrics.height, 0));
  }
  if (!Number.isFinite(minY) || !Number.isFinite(maxY) || maxY <= minY) {
    return 0;
  }

  const blockH = maxY - minY;
  const logoBottom = logoBoxPx.y + logoBoxPx.h;
  const available = dims.height - logoBottom;
  if (available <= blockH) return 0;
  const gap = (available - blockH) / 2;
  return logoBottom + gap - minY;
}

function drawElement(
  ctx: Ctx,
  el: TemplateElement,
  content: CustomSlideContent,
  dims: SlideDims,
  assets: RenderAssets,
  sampleMode: boolean,
  logoBoxPx?: { x: number; y: number; w: number; h: number } | null,
  textYShift = 0,
) {
  const { width, height } = dims;
  const scale = Math.min(width, height) / 1080;
  const rawBox =
    el.kind === "logo" && logoBoxPx
      ? logoBoxPx
      : boxToPixels(el.box, width, height);
  const pinned = pinBoxToLogoLeft(el, rawBox, logoBoxPx ?? null);
  const box =
    textYShift !== 0 && isWdcLeftColumn(el)
      ? { ...pinned, y: pinned.y + textYShift }
      : pinned;

  switch (el.kind) {
    case "rect": {
      ctx.save();
      ctx.globalAlpha = el.opacity;
      ctx.fillStyle = el.fill;
      const r = el.radiusFraction * Math.min(box.w, box.h);
      if (r > 0) {
        ctx.beginPath();
        ctx.roundRect(box.x, box.y, box.w, box.h, r);
        ctx.fill();
      } else {
        ctx.fillRect(box.x, box.y, box.w, box.h);
      }
      ctx.restore();
      break;
    }
    case "line": {
      ctx.strokeStyle = el.color;
      ctx.lineWidth = el.thicknessFraction * height;
      ctx.beginPath();
      if (box.w >= box.h) {
        const cy = box.y + box.h / 2;
        ctx.moveTo(box.x, cy);
        ctx.lineTo(box.x + box.w, cy);
      } else {
        const cx = box.x + box.w / 2;
        ctx.moveTo(cx, box.y);
        ctx.lineTo(cx, box.y + box.h);
      }
      ctx.stroke();
      break;
    }
    case "image": {
      const slot = sampleMode ? null : content.images[el.slot];
      const url = slot?.url ?? null;
      const img = url ? assets.slideImages.get(url) ?? null : null;
      const edits = slot?.edits ?? el.defaultEdits ?? DEFAULT_IMAGE_EDIT_SETTINGS;
      if (img) {
        drawEditedImageCover(ctx, img, box.x, box.y, box.w, box.h, edits);
      } else if (!sampleMode) {
        drawPlaceholder(
          ctx,
          box.x,
          box.y,
          box.w,
          box.h,
          "Foto hochladen",
          scale,
        );
      }
      break;
    }
    case "partnerLogo": {
      const slot = sampleMode ? null : content.images[el.slot];
      const url = slot?.url ?? null;
      const img = url ? assets.partnerLogos.get(url) ?? null : null;
      if (img) {
        drawPartnerLogoInBox(ctx, img, box, {
          whiteOverlay: slot?.whiteOverlay,
        });
      } else if (sampleMode) {
        drawPlaceholder(ctx, box.x, box.y, box.w, box.h, "Partner", scale);
      }
      break;
    }
    case "logo": {
      const dest = logoDrawRect(box);
      const logo = pickLogo(
        ctx,
        el.variant,
        dest,
        assets.logo,
        assets.logoWhite,
      );
      drawLogoInBox(ctx, logo, box);
      break;
    }
    case "text": {
      const text = resolveElementText(el, content, sampleMode);
      if (!text) return;
      const { fontSize, lineHeight } = textBoxMetrics(
        ctx,
        el,
        text,
        box,
        height,
      );
      const inkInset =
        el.style.align === "right" || !logoBoxPx || !isWdcLeftColumn(el)
          ? 0
          : measureLeftInkInset(
              ctx,
              text,
              fontSize,
              el.style.fontWeight,
              FONT,
            );
      const textX =
        el.style.align === "right" ? box.x + box.w : box.x - inkInset;
      const drawOpts = {
        x: textX,
        y: box.y,
        maxWidth: box.w,
        fontSize,
        fontWeight: el.style.fontWeight,
        lineHeight,
        baseColor: el.style.baseColor,
        highlightColor: el.style.highlightColor,
        fontFamily: FONT,
        textAlign: el.style.align,
      };
      drawRichText(ctx, text, drawOpts);
      if (el.field === "heading" && assets.hdrHeadline) {
        overlayHeadlineHdrMap(
          ctx,
          text,
          drawOpts,
          assets.hdrHeadlineAmount,
        );
      }
      break;
    }
  }
}

function wdcDrawnLogoBox(template: CustomTemplate, dims: SlideDims) {
  if (template.backgroundImageSrc !== WDC_BG_FILE) return null;
  if (isWdcFeedGridCanvas(dims.width, dims.height)) {
    return logoDrawRect(wdcFeedGridLogoBox(dims.width, dims.height));
  }
  const logoEl = template.elements.find((item) => item.kind === "logo");
  if (!logoEl) return null;
  return logoDrawRect(boxToPixels(logoEl.box, dims.width, dims.height));
}

export function renderCustomTemplateToContext(
  ctx: Ctx,
  template: CustomTemplate,
  content: CustomSlideContent,
  dims: SlideDims,
  assets: RenderAssets,
): void {
  drawTemplatePlate(
    ctx,
    template,
    dims,
    assets,
    content.plateEdits,
    content.plateMode,
  );
  const logoBoxPx = wdcDrawnLogoBox(template, dims);
  const textYShift = isWdcFeedGridCanvas(dims.width, dims.height)
    ? wdcTextColumnYShift(
        ctx,
        template,
        content,
        dims,
        logoBoxPx,
        false,
      )
    : 0;
  for (const el of template.elements) {
    drawElement(ctx, el, content, dims, assets, false, logoBoxPx, textYShift);
  }
}

export function renderCustomTemplateSampleToContext(
  ctx: Ctx,
  template: CustomTemplate,
  dims: SlideDims,
  assets: RenderAssets,
): void {
  drawTemplatePlate(ctx, template, dims, assets);
  const sampleContent: CustomSlideContent = { fields: {}, images: {} };
  for (const el of template.elements) {
    if (el.kind === "text") sampleContent.fields[el.field] = el.defaultText || el.label;
  }
  const logoBoxPx = wdcDrawnLogoBox(template, dims);
  const textYShift = isWdcFeedGridCanvas(dims.width, dims.height)
    ? wdcTextColumnYShift(
        ctx,
        template,
        sampleContent,
        dims,
        logoBoxPx,
        true,
      )
    : 0;
  for (const el of template.elements) {
    drawElement(
      ctx,
      el,
      sampleContent,
      dims,
      assets,
      true,
      logoBoxPx,
      textYShift,
    );
  }
}

export function renderCustomTemplateThumbnail(
  template: CustomTemplate,
  assets: RenderAssets,
  maxPx = 120,
): string | null {
  if (typeof document === "undefined") return null;
  const aspect = template.baseAspect;
  const width = maxPx;
  const height = Math.round(maxPx / aspect);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  renderCustomTemplateSampleToContext(ctx, template, { width, height }, assets);
  return canvas.toDataURL("image/png");
}

export const CUSTOM_DEFAULT_COLORS = {
  text: LAB_TEXT,
  muted: LAB_MUTED,
  blue: LAB_BLUE,
  bg: LAB_BG,
};

export type { ImageEditSettings, NormalizedBox };

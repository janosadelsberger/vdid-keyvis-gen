export type FocalPoint = { x: number; y: number };

export type ImageEditSettings = {
  focalPoint: FocalPoint;
  overlayEnabled: boolean;
  overlayOpacity: number;
  grayscaleEnabled: boolean;
  blueTintEnabled: boolean;
  blueTintOpacity: number;
};

export const DEFAULT_IMAGE_EDIT_SETTINGS: ImageEditSettings = {
  focalPoint: { x: 0.5, y: 0.5 },
  overlayEnabled: false,
  overlayOpacity: 0.35,
  grayscaleEnabled: false,
  blueTintEnabled: false,
  blueTintOpacity: 0.22,
};

export const VDID_BLUE_RGB = { r: 10, g: 44, b: 217 } as const;

export type BitmapSource = CanvasImageSource & {
  naturalWidth?: number;
  naturalHeight?: number;
  width: number;
  height: number;
};

export function clientPointToFocalNormalized(
  clientX: number,
  clientY: number,
  containerRect: DOMRect,
  naturalW: number,
  naturalH: number,
): FocalPoint {
  const cw = containerRect.width;
  const ch = containerRect.height;
  const px = clientX - containerRect.left;
  const py = clientY - containerRect.top;
  const scale = Math.min(cw / naturalW, ch / naturalH);
  const dispW = naturalW * scale;
  const dispH = naturalH * scale;
  const offX = (cw - dispW) / 2;
  const offY = (ch - dispH) / 2;
  const nx = (px - offX) / dispW;
  const ny = (py - offY) / dispH;
  return {
    x: Math.min(1, Math.max(0, nx)),
    y: Math.min(1, Math.max(0, ny)),
  };
}

/** Cover-fit image into a canvas region with optional focal point and grayscale. */
export function drawBackgroundCover(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  img: BitmapSource,
  focalX: number,
  focalY: number,
  grayscale: boolean,
) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (iw <= 0 || ih <= 0) return;

  const scale = Math.max(width / iw, height / ih);
  const drawW = iw * scale;
  const drawH = ih * scale;
  const dxIdeal = width / 2 - focalX * drawW;
  const dyIdeal = height / 2 - focalY * drawH;
  const dx = Math.min(0, Math.max(width - drawW, dxIdeal));
  const dy = Math.min(0, Math.max(height - drawH, dyIdeal));

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, width, height);
  ctx.clip();
  if (grayscale) {
    ctx.filter = "grayscale(1)";
  }
  ctx.drawImage(img, dx, dy, drawW, drawH);
  ctx.restore();
}

export function applyImageEditOverlays(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  settings: ImageEditSettings,
) {
  if (settings.overlayEnabled && settings.overlayOpacity > 0) {
    ctx.fillStyle = `rgba(0,0,0,${settings.overlayOpacity})`;
    ctx.fillRect(0, 0, width, height);
  }

  if (settings.blueTintEnabled && settings.blueTintOpacity > 0) {
    const { r, g, b } = VDID_BLUE_RGB;
    ctx.fillStyle = `rgba(${r},${g},${b},${settings.blueTintOpacity})`;
    ctx.fillRect(0, 0, width, height);
  }
}

/** Draw a cover-cropped image with focal point and filter overlays inside a rect. */
export function drawEditedImageCover(
  ctx: CanvasRenderingContext2D,
  img: BitmapSource,
  x: number,
  y: number,
  w: number,
  h: number,
  settings: ImageEditSettings,
) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.translate(x, y);
  drawBackgroundCover(
    ctx,
    w,
    h,
    img,
    settings.focalPoint.x,
    settings.focalPoint.y,
    settings.grayscaleEnabled,
  );
  applyImageEditOverlays(ctx, w, h, settings);
  ctx.restore();
}

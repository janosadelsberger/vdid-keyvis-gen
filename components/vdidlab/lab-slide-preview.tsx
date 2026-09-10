"use client";

import React from "react";
import type { CustomTemplate } from "@/lib/custom-template";
import {
  renderLabSlideToContext,
  type LabSlide,
  type LabLogoStyle,
  type RenderAssets,
} from "@/lib/lab-slide-render";
import {
  beginHdrHeadlineCollection,
  consumeHdrHeadlinePasses,
  get2dContext,
  paintHdrHeadlinePasses,
} from "@/lib/hdr-headline";
import { cn } from "@/lib/utils";

export type LabSlidePreviewProps = {
  slide: LabSlide;
  width: number;
  height: number;
  topUiSafeInsetRatio?: number;
  logoRef: React.RefObject<HTMLImageElement | null>;
  logoWhiteRef?: React.RefObject<HTMLImageElement | null>;
  slideImagesRef: React.RefObject<Map<string, HTMLImageElement>>;
  partnerLogosRef: React.RefObject<Map<string, HTMLImageElement>>;
  customTemplatesRef?: React.RefObject<Map<string, CustomTemplate>>;
  bundledImagesRef?: React.RefObject<Map<string, HTMLImageElement>>;
  backgroundVideoRef?: React.RefObject<HTMLVideoElement | null>;
  animateVideo?: boolean;
  logoStyle?: LabLogoStyle;
  logoLoaded: boolean;
  /** Bump when async images finish loading into the ref maps. */
  renderRevision?: number;
  maxHeight?: number;
  className?: string;
  canvasClassName?: string;
  onClick?: () => void;
  disabled?: boolean;
  ariaLabel?: string;
  hdrHeadline?: boolean;
  hdrHeadlineAmount?: number;
};

export const LabSlidePreview = React.forwardRef<
  HTMLCanvasElement,
  LabSlidePreviewProps
>(function LabSlidePreview(
  {
    slide,
    width,
    height,
    topUiSafeInsetRatio,
    logoRef,
    logoWhiteRef,
    slideImagesRef,
    partnerLogosRef,
    customTemplatesRef,
    bundledImagesRef,
    backgroundVideoRef,
    animateVideo = false,
    logoStyle = "color",
    logoLoaded,
    renderRevision = 0,
    maxHeight = 480,
    className,
    canvasClassName,
    onClick,
    disabled,
    ariaLabel,
    hdrHeadline = false,
    hdrHeadlineAmount,
  },
  ref,
) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const hdrOverlayRef = React.useRef<HTMLCanvasElement>(null);

  React.useImperativeHandle(ref, () => canvasRef.current as HTMLCanvasElement);

  React.useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const logo = logoRef.current;
    if (!canvas || !logo || !logoLoaded) return;
    const ctx = get2dContext(canvas, { willReadFrequently: true });
    if (!ctx) return;

    canvas.width = width;
    canvas.height = height;

    let overlayPainted = false;

    const draw = () => {
      const assets: RenderAssets = {
        logoStyle,
        logo,
        logoWhite: logoWhiteRef?.current ?? null,
        slideImages: slideImagesRef.current ?? new Map(),
        partnerLogos: partnerLogosRef.current ?? new Map(),
        customTemplates: customTemplatesRef?.current ?? new Map(),
        bundledImages: bundledImagesRef?.current ?? new Map(),
        backgroundVideo: backgroundVideoRef?.current ?? null,
        hdrHeadline,
        hdrHeadlineAmount,
      };
      beginHdrHeadlineCollection();
      renderLabSlideToContext(
        ctx,
        slide,
        { width, height, topUiSafeInsetRatio },
        assets,
      );
      const passes = consumeHdrHeadlinePasses(ctx);
      const overlay = hdrOverlayRef.current;
      if (!hdrHeadline || !overlay || overlayPainted) return;
      if (passes.length === 0) return;
      overlay.style.setProperty("dynamic-range", "high");
      overlay.style.setProperty("dynamic-range-limit", "no-limit");
      overlayPainted = true;
      void paintHdrHeadlinePasses(overlay, width, height, passes).then(
        (mode) => {
          if (mode === "none") overlayPainted = false;
        },
      );
    };

    draw();

    const video = backgroundVideoRef?.current;
    if (!animateVideo || !video || video.paused || video.ended) return;

    let raf = 0;
    const tick = () => {
      draw();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [
    slide,
    width,
    height,
    topUiSafeInsetRatio,
    logoLoaded,
    renderRevision,
    logoStyle,
    animateVideo,
    logoRef,
    logoWhiteRef,
    slideImagesRef,
    partnerLogosRef,
    customTemplatesRef,
    bundledImagesRef,
    backgroundVideoRef,
    hdrHeadline,
    hdrHeadlineAmount,
  ]);

  const canvases = (
    <div className="relative inline-block leading-none">
      <canvas
        ref={canvasRef}
        className={cn("block max-w-full bg-[#F0F0F0]", canvasClassName)}
        style={{
          maxHeight,
          aspectRatio: `${width} / ${height}`,
        }}
      />
      {hdrHeadline ? (
        <canvas
          key="hdr-overlay"
          ref={hdrOverlayRef}
          className="pointer-events-none absolute inset-0 h-full w-full"
          aria-hidden
        />
      ) : null}
    </div>
  );

  if (!onClick) {
    return (
      <div className={cn("flex justify-center", className)}>{canvases}</div>
    );
  }

  return (
    <div className={cn("flex justify-center", className)}>
      <button
        type="button"
        className="relative cursor-pointer rounded outline-none disabled:cursor-not-allowed disabled:opacity-60"
        onClick={(e) => {
          onClick();
          e.currentTarget.blur();
        }}
        disabled={disabled}
        aria-label={ariaLabel}
      >
        {canvases}
      </button>
    </div>
  );
});

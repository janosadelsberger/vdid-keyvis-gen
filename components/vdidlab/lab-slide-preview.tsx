"use client";

import React from "react";
import {
  renderLabSlideToContext,
  type LabSlide,
  type RenderAssets,
} from "@/lib/lab-slide-render";
import { cn } from "@/lib/utils";

export type LabSlidePreviewProps = {
  slide: LabSlide;
  width: number;
  height: number;
  topUiSafeInsetRatio?: number;
  logoRef: React.RefObject<HTMLImageElement | null>;
  slideImagesRef: React.RefObject<Map<string, HTMLImageElement>>;
  partnerLogosRef: React.RefObject<Map<string, HTMLImageElement>>;
  logoLoaded: boolean;
  /** Bump when async images finish loading into the ref maps. */
  renderRevision?: number;
  maxHeight?: number;
  className?: string;
  canvasClassName?: string;
  onClick?: () => void;
  disabled?: boolean;
  ariaLabel?: string;
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
    slideImagesRef,
    partnerLogosRef,
    logoLoaded,
    renderRevision = 0,
    maxHeight = 480,
    className,
    canvasClassName,
    onClick,
    disabled,
    ariaLabel,
  },
  ref,
) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useImperativeHandle(ref, () => canvasRef.current as HTMLCanvasElement);

  React.useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const logo = logoRef.current;
    if (!canvas || !logo || !logoLoaded) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = width;
    canvas.height = height;

    const assets: RenderAssets = {
      logo,
      slideImages: slideImagesRef.current ?? new Map(),
      partnerLogos: partnerLogosRef.current ?? new Map(),
    };

    renderLabSlideToContext(
      ctx,
      slide,
      { width, height, topUiSafeInsetRatio },
      assets,
    );
  }, [
    slide,
    width,
    height,
    topUiSafeInsetRatio,
    logoLoaded,
    renderRevision,
    logoRef,
    slideImagesRef,
    partnerLogosRef,
  ]);

  const canvas = (
    <canvas
      ref={canvasRef}
      className={cn("block max-w-full bg-[#F0F0F0]", canvasClassName)}
      style={{
        maxHeight,
        aspectRatio: `${width} / ${height}`,
      }}
    />
  );

  if (!onClick) {
    return <div className={cn("flex justify-center", className)}>{canvas}</div>;
  }

  return (
    <div className={cn("flex justify-center", className)}>
      <button
        type="button"
        className="group relative cursor-zoom-in rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vdidBlue disabled:cursor-not-allowed disabled:opacity-60"
        onClick={onClick}
        disabled={disabled}
        aria-label={ariaLabel}
      >
        {canvas}
      </button>
    </div>
  );
});

"use client";

import React from "react";
import { LabSlidePreview } from "@/components/vdidlab/lab-slide-preview";
import type { LabSlide } from "@/lib/lab-slide-render";

type PreviewFormat = {
  width: number;
  height: number;
  topUiSafeInsetRatio?: number;
};

export type LabSlidePreviewStripProps = {
  slides: LabSlide[];
  selectedId: string | null;
  previewFormat: PreviewFormat;
  logoRef: React.RefObject<HTMLImageElement | null>;
  slideImagesRef: React.RefObject<Map<string, HTMLImageElement>>;
  partnerLogosRef: React.RefObject<Map<string, HTMLImageElement>>;
  logoLoaded: boolean;
  previewRevision: number;
  maxHeight?: number;
  selectedCanvasRef?: React.Ref<HTMLCanvasElement | null>;
  onAddSlide?: () => void;
  onSlideClick?: (slideId: string) => void;
};

export function LabSlidePreviewStrip({
  slides,
  selectedId,
  previewFormat,
  logoRef,
  slideImagesRef,
  partnerLogosRef,
  logoLoaded,
  previewRevision,
  maxHeight = 480,
  selectedCanvasRef,
  onAddSlide,
  onSlideClick,
}: LabSlidePreviewStripProps) {
  return (
    <div className="overflow-x-auto py-2">
      <div className="flex w-max items-stretch">
        {slides.map((slide) => (
          <div
            key={slide.id}
            className="relative shrink-0 overflow-hidden bg-[#F0F0F0]"
          >
            <LabSlidePreview
              ref={
                selectedCanvasRef && slide.id === selectedId
                  ? (selectedCanvasRef as React.Ref<HTMLCanvasElement>)
                  : undefined
              }
              slide={slide}
              width={previewFormat.width}
              height={previewFormat.height}
              topUiSafeInsetRatio={previewFormat.topUiSafeInsetRatio}
              logoRef={logoRef}
              slideImagesRef={slideImagesRef}
              partnerLogosRef={partnerLogosRef}
              logoLoaded={logoLoaded}
              renderRevision={previewRevision}
              maxHeight={maxHeight}
              className="!block w-fit leading-none"
              canvasClassName="block max-w-none"
              onClick={
                onSlideClick ? () => onSlideClick(slide.id) : undefined
              }
              disabled={!logoLoaded}
              ariaLabel="Vorschau vergrößern"
            />
          </div>
        ))}
        {onAddSlide && (
          <button
            type="button"
            onClick={onAddSlide}
            className="ml-3 flex w-24 shrink-0 flex-col items-center justify-center gap-1 self-stretch border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500 transition-colors hover:border-vdidBlue hover:text-vdidBlue"
            aria-label="Slide hinzufügen"
          >
            <span className="text-2xl leading-none">+</span>
            Slide
          </button>
        )}
      </div>
    </div>
  );
}

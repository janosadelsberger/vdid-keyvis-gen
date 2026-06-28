"use client";

import React from "react";
import { LabSlidePreview } from "@/components/vdidlab/lab-slide-preview";
import type { LabSlide } from "@/lib/lab-slide-render";
import { cn } from "@/lib/utils";

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
  logoWhiteRef?: React.RefObject<HTMLImageElement | null>;
  slideImagesRef: React.RefObject<Map<string, HTMLImageElement>>;
  partnerLogosRef: React.RefObject<Map<string, HTMLImageElement>>;
  logoLoaded: boolean;
  previewRevision: number;
  maxHeight?: number;
  selectedCanvasRef?: React.Ref<HTMLCanvasElement | null>;
  onAddSlide?: () => void;
  onSlideClick?: (slideId: string) => void;
  onSlideZoom?: (slideId: string) => void;
  onDeleteSlide?: (slideId: string) => void;
};

export function LabSlidePreviewStrip({
  slides,
  selectedId,
  previewFormat,
  logoRef,
  logoWhiteRef,
  slideImagesRef,
  partnerLogosRef,
  logoLoaded,
  previewRevision,
  maxHeight = 480,
  selectedCanvasRef,
  onAddSlide,
  onSlideClick,
  onSlideZoom,
  onDeleteSlide,
}: LabSlidePreviewStripProps) {
  const canDelete = onDeleteSlide && slides.length > 1;
  const showActions = onSlideZoom || canDelete;

  const actionButtonClass = cn(
    "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
    "shadow-sm transition-colors outline-none",
  );

  const zoomButtonClass = cn(
    actionButtonClass,
    "bg-slate-900/75 text-white hover:bg-slate-900",
  );

  const deleteButtonClass = cn(
    actionButtonClass,
    "bg-red-600/90 text-white hover:bg-red-700",
  );

  return (
    <div className="overflow-x-auto py-2">
      <div className="flex w-max items-stretch">
        {slides.map((slide) => (
          <div
            key={slide.id}
            className="group relative shrink-0 overflow-hidden bg-[#F0F0F0]"
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
              logoWhiteRef={logoWhiteRef}
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
              ariaLabel="Slide auswählen"
            />
            {showActions && (
              <div
                className={cn(
                  "absolute right-2 top-2 z-10 flex items-center gap-1.5",
                  "pointer-events-none opacity-0 transition-opacity",
                  "group-hover:pointer-events-auto group-hover:opacity-100",
                  "focus-within:pointer-events-auto focus-within:opacity-100",
                )}
              >
                {onSlideZoom && (
                  <button
                    type="button"
                    className={zoomButtonClass}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSlideZoom(slide.id);
                      e.currentTarget.blur();
                    }}
                    aria-label="Vorschau vergrößern"
                    title="Vergrößern"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-4 w-4"
                      aria-hidden
                    >
                      <circle cx="11" cy="11" r="8" />
                      <path d="m21 21-4.3-4.3" />
                    </svg>
                  </button>
                )}
                {canDelete && (
                  <button
                    type="button"
                    className={deleteButtonClass}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSlide(slide.id);
                      e.currentTarget.blur();
                    }}
                    aria-label="Slide löschen"
                    title="Slide löschen"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-4 w-4"
                      aria-hidden
                    >
                      <path d="M18 6 6 18" />
                      <path d="m6 6 12 12" />
                    </svg>
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
        {onAddSlide && (
          <button
            type="button"
            onClick={onAddSlide}
            className="ml-4 flex w-20 shrink-0 flex-col items-center justify-center gap-1 self-stretch rounded-md border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500 transition-colors hover:border-vdidBlue hover:text-vdidBlue"
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

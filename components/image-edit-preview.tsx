"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  applyImageEditOverlays,
  clientPointToFocalNormalized,
  drawBackgroundCover,
  type FocalPoint,
  type ImageEditSettings,
} from "@/lib/image-edit";

export type ImageEditPreviewProps = {
  image: HTMLImageElement;
  naturalSize: { width: number; height: number };
  settings: ImageEditSettings;
  onFocalPointChange: (point: FocalPoint) => void;
};

export function ImageEditPreview({
  image,
  naturalSize,
  settings,
  onFocalPointChange,
}: ImageEditPreviewProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const [markerPx, setMarkerPx] = React.useState<{
    left: number;
    top: number;
  } | null>(null);

  React.useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image.complete) return;

    const aspect = naturalSize.width / naturalSize.height;
    const maxW = 480;
    const w = Math.min(maxW, naturalSize.width);
    const h = Math.round(w / aspect);
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#0A2CD9";
    ctx.fillRect(0, 0, w, h);
    drawBackgroundCover(
      ctx,
      w,
      h,
      image,
      settings.focalPoint.x,
      settings.focalPoint.y,
      settings.grayscaleEnabled,
    );
    applyImageEditOverlays(ctx, w, h, settings);
  }, [image, naturalSize, settings]);

  React.useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) {
      setMarkerPx(null);
      return;
    }
    const update = () => {
      const W = el.clientWidth;
      const H = el.clientHeight;
      const { width: nw, height: nh } = naturalSize;
      const scale = Math.min(W / nw, H / nh);
      const dispW = nw * scale;
      const dispH = nh * scale;
      const offX = (W - dispW) / 2;
      const offY = (H - dispH) / 2;
      setMarkerPx({
        left: offX + settings.focalPoint.x * dispW,
        top: offY + settings.focalPoint.y * dispH,
      });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [settings.focalPoint, naturalSize]);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    onFocalPointChange(
      clientPointToFocalNormalized(
        e.clientX,
        e.clientY,
        rect,
        naturalSize.width,
        naturalSize.height,
      ),
    );
  };

  return (
    <div className="space-y-2">
      <Label>Vorschau — Klick setzt den Blickpunkt</Label>
      <div
        ref={containerRef}
        role="button"
        tabIndex={0}
        className="relative mx-auto w-full max-w-xl cursor-crosshair rounded-md border border-slate-200 bg-slate-100 p-2"
        style={{ minHeight: 120, maxHeight: 220 }}
        onClick={handleClick}
        onKeyDown={(ev) => {
          if (ev.key === "Enter" || ev.key === " ") ev.preventDefault();
        }}
      >
        <canvas
          ref={canvasRef}
          className="mx-auto block max-h-52 max-w-full"
          aria-hidden
        />
        {markerPx && (
          <span
            className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-vdidBlue shadow-md ring-2 ring-white/80"
            style={{ left: markerPx.left, top: markerPx.top }}
            aria-hidden
          />
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
        <span>
          Blickpunkt: {Math.round(settings.focalPoint.x * 100)}% ×{" "}
          {Math.round(settings.focalPoint.y * 100)}%
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => onFocalPointChange({ x: 0.5, y: 0.5 })}
        >
          Mitte
        </Button>
      </div>
    </div>
  );
}

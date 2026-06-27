"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ImageDropZoneProps = {
  id: string;
  previewUrl?: string | null;
  onFile: (file: File) => void;
  onClear?: () => void;
  chooseLabel?: string;
  hint?: string;
  compact?: boolean;
  /** When false, only show upload actions if a preview URL exists (no thumbnail). */
  showPreview?: boolean;
  className?: string;
};

export function ImageDropZone({
  id,
  previewUrl,
  onFile,
  onClear,
  chooseLabel = "Datei wählen",
  hint,
  compact = false,
  showPreview = true,
  className,
}: ImageDropZoneProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dropActive, setDropActive] = React.useState(false);

  const applyFile = (file: File | undefined) => {
    if (!file || !file.type.startsWith("image/")) return;
    onFile(file);
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget;
    const related = e.relatedTarget as Node | null;
    if (related && target.contains(related)) return;
    setDropActive(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget;
    const related = e.relatedTarget as Node | null;
    if (related && target.contains(related)) return;
    setDropActive(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDropActive(false);
    applyFile(e.dataTransfer.files?.[0]);
  };

  return (
    <>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          applyFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <div
        className={cn(
          "relative flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-4 text-center transition-colors",
          previewUrl
            ? compact
              ? "min-h-[88px] py-4"
              : "min-h-[88px] py-5"
            : compact
              ? "min-h-[120px] py-8"
              : "min-h-[140px] py-10",
          dropActive
            ? "border-vdidBlue bg-blue-50 ring-2 ring-vdidBlue/25"
            : "border-slate-300 bg-slate-50 hover:border-slate-400",
          className,
        )}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {previewUrl ? (
          <>
            {showPreview && (
              <img
                src={previewUrl}
                alt=""
                className="max-h-36 max-w-full rounded-md object-contain"
                draggable={false}
              />
            )}
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => inputRef.current?.click()}
              >
                Anderes Bild wählen
              </Button>
              {onClear && (
                <Button type="button" variant="outline" size="sm" onClick={onClear}>
                  Entfernen
                </Button>
              )}
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-slate-700">
              <label
                htmlFor={id}
                className="cursor-pointer font-medium text-vdidBlue underline-offset-4 hover:underline"
              >
                {chooseLabel}
              </label>
              <span className="text-slate-600"> oder Bild hierher ziehen</span>
            </p>
            {hint && (
              <p className="max-w-md text-xs text-slate-500">{hint}</p>
            )}
          </>
        )}
      </div>
    </>
  );
}

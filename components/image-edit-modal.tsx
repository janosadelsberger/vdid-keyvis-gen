"use client";

import React from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { CardTitle } from "@/components/ui/card";
import { ImageDropZone } from "@/components/image-drop-zone";
import { ImageEditControls } from "@/components/image-edit-controls";
import { ImageEditPreview } from "@/components/image-edit-preview";
import {
  DEFAULT_IMAGE_EDIT_SETTINGS,
  type ImageEditSettings,
} from "@/lib/image-edit";

export type ImageEditModalProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  imageUrl: string | null;
  naturalSize: { width: number; height: number } | null;
  settings: ImageEditSettings;
  onSettingsChange: (settings: ImageEditSettings) => void;
  onFileSelected?: (file: File) => void;
  onClearImage?: () => void;
  uploadHint?: string;
  idPrefix?: string;
};

export function ImageEditModal({
  open,
  onClose,
  title = "Bild bearbeiten",
  imageUrl,
  naturalSize,
  settings,
  onSettingsChange,
  onFileSelected,
  onClearImage,
  uploadHint,
  idPrefix = "image-edit-modal",
}: ImageEditModalProps) {
  const [loadedPreview, setLoadedPreview] =
    React.useState<HTMLImageElement | null>(null);

  React.useEffect(() => {
    if (!open || !imageUrl) {
      setLoadedPreview(null);
      return;
    }
    const img = new Image();
    img.onload = () => setLoadedPreview(img);
    img.onerror = () => setLoadedPreview(null);
    img.src = imageUrl;
  }, [open, imageUrl]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  const canPreview = !!loadedPreview && !!naturalSize;
  const showUpload = !!onFileSelected;

  const handleReset = () => {
    onSettingsChange({ ...DEFAULT_IMAGE_EDIT_SETTINGS });
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4">
          <CardTitle className="text-lg">{title}</CardTitle>
        </div>

        <div className="space-y-5 px-5 py-5">
          {showUpload && (
            <ImageDropZone
              id={`${idPrefix}-upload`}
              previewUrl={imageUrl}
              showPreview={!canPreview}
              onFile={onFileSelected}
              onClear={onClearImage}
              hint={uploadHint}
              compact
            />
          )}

          {canPreview && (
            <ImageEditPreview
              image={loadedPreview}
              naturalSize={naturalSize}
              settings={settings}
              onFocalPointChange={(focalPoint) =>
                onSettingsChange({ ...settings, focalPoint })
              }
            />
          )}

          <ImageEditControls
            settings={settings}
            onChange={onSettingsChange}
            idPrefix={idPrefix}
          />
        </div>

        <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-4">
          <Button type="button" variant="outline" onClick={handleReset}>
            Zurücksetzen
          </Button>
          <Button type="button" onClick={onClose}>
            Fertig
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

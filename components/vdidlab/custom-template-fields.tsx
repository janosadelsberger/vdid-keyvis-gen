"use client";

import React from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ImageDropZone } from "@/components/image-drop-zone";
import type { CustomTemplate } from "@/lib/custom-template";
import type { LabSlide } from "@/lib/lab-slide-render";
import {
  applyCanvasEnterKey,
  CANVAS_BREAK_HINT,
  MARKDOWN_FORMAT_HINT,
} from "@/lib/canvas-richtext";

export function onCanvasTextareaKeyDown(
  e: React.KeyboardEvent<HTMLTextAreaElement>,
  value: string,
  onChange: (next: string) => void,
) {
  if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
  if (!e.shiftKey) return;
  e.preventDefault();
  const el = e.currentTarget;
  const next = applyCanvasEnterKey(
    value,
    el.selectionStart ?? value.length,
    el.selectionEnd ?? value.length,
    true,
  );
  onChange(next.value);
  requestAnimationFrame(() => {
    el.selectionStart = next.caret;
    el.selectionEnd = next.caret;
  });
}

export type CustomTemplateFieldsProps = {
  slide: LabSlide;
  template: CustomTemplate;
  onFieldChange: (field: string, value: string) => void;
  onImageUpload: (
    slot: string,
    kind: "image" | "partnerLogo",
    file: File | undefined,
  ) => void;
  onImageClear: (slot: string, kind: "image" | "partnerLogo") => void;
  onImageEdit?: (slot: string) => void;
  onPartnerWhiteOverlay?: (slot: string, enabled: boolean) => void;
};

export function CustomTemplateFields({
  slide,
  template,
  onFieldChange,
  onImageUpload,
  onImageClear,
  onImageEdit,
  onPartnerWhiteOverlay,
}: CustomTemplateFieldsProps) {
  const textElements = template.elements.filter((el) => el.kind === "text");
  const imageElements = template.elements.filter(
    (el) => el.kind === "image" || el.kind === "partnerLogo",
  );

  if (textElements.length === 0 && imageElements.length === 0) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400 md:col-span-2">
        Diese Vorlage hat keine bearbeitbaren Platzhalter.
      </p>
    );
  }

  return (
    <>
      {textElements.map((el) => (
        <div key={el.id} className="space-y-1 md:col-span-2">
          <Label htmlFor={`custom-field-${el.field}`}>{el.label || el.field}</Label>
          <Textarea
            id={`custom-field-${el.field}`}
            value={slide.fields?.[el.field] ?? ""}
            onChange={(e) => onFieldChange(el.field, e.target.value)}
            onKeyDown={(e) =>
              onCanvasTextareaKeyDown(
                e,
                slide.fields?.[el.field] ?? "",
                (next) => onFieldChange(el.field, next),
              )
            }
            rows={
              el.defaultText.length > 60 ||
              el.defaultText.includes("\n") ||
              el.field.includes("body") ||
              el.field.includes("date")
                ? 4
                : 2
            }
            className="resize-y"
          />
          <p className="text-xs text-slate-500 dark:text-slate-400">{MARKDOWN_FORMAT_HINT}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{CANVAS_BREAK_HINT}</p>
        </div>
      ))}
      {imageElements.map((el) => {
        const slot = el.slot;
        const url = slide.images?.[slot]?.url ?? null;
        return (
          <div key={el.id} className="space-y-2 md:col-span-2">
            <Label>{el.label || slot}</Label>
            <ImageDropZone
              id={`custom-image-${slot}`}
              previewUrl={url}
              onFile={(file) =>
                onImageUpload(slot, el.kind === "partnerLogo" ? "partnerLogo" : "image", file)
              }
              onClear={() =>
                onImageClear(slot, el.kind === "partnerLogo" ? "partnerLogo" : "image")
              }
              chooseLabel="Bild wählen"
            />
            {el.kind === "image" && url && onImageEdit && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onImageEdit(slot)}
              >
                Bild bearbeiten…
              </Button>
            )}
            {el.kind === "partnerLogo" && url && onPartnerWhiteOverlay && (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={`partner-white-${slot}`}
                    checked={!!slide.images?.[slot]?.whiteOverlay}
                    onChange={(e) =>
                      onPartnerWhiteOverlay(slot, e.target.checked)
                    }
                  />
                  <Label
                    htmlFor={`partner-white-${slot}`}
                    className="cursor-pointer"
                  >
                    Mit Weiß überlagern
                  </Label>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Nimmt den Alpha-Kanal der PNG und färbt das Logo weiß — lesbar
                  auf dunklem Grund.
                </p>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

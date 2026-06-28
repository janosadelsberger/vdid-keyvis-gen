"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import type { LabSlide } from "@/lib/lab-slide-render";
import { cn } from "@/lib/utils";

export type PostSlideOrderBarProps = {
  slides: LabSlide[];
  selectedId: string;
  onSelect: (id: string) => void;
  onReorder: (dragId: string, insertIndex: number) => void;
  onDuplicate?: (id: string) => void;
  onDelete?: (id: string) => void;
};

function insertIndexFromDragOver(
  clientX: number,
  rect: DOMRect,
  chipIndexInBase: number,
): number {
  const midX = rect.left + rect.width / 2;
  return clientX < midX ? chipIndexInBase : chipIndexInBase + 1;
}

function captureChipRects(
  chipRefs: React.RefObject<Map<string, HTMLButtonElement>>,
  skipId?: string | null,
): Map<string, DOMRect> {
  const rects = new Map<string, DOMRect>();
  chipRefs.current?.forEach((el, id) => {
    if (id !== skipId) rects.set(id, el.getBoundingClientRect());
  });
  return rects;
}

function clearChipTransforms(
  chipRefs: React.RefObject<Map<string, HTMLButtonElement>>,
) {
  chipRefs.current?.forEach((el) => {
    el.style.transition = "";
    el.style.transform = "";
  });
}

export function PostSlideOrderBar({
  slides,
  selectedId,
  onSelect,
  onReorder,
  onDuplicate,
  onDelete,
}: PostSlideOrderBarProps) {
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [insertIndex, setInsertIndex] = React.useState<number | null>(null);
  const chipRefs = React.useRef<Map<string, HTMLButtonElement>>(new Map());
  const prevRects = React.useRef<Map<string, DOMRect>>(new Map());
  const animFrameRef = React.useRef<number | null>(null);
  const droppedRef = React.useRef(false);

  const draggedSlide = dragId
    ? slides.find((s) => s.id === dragId) ?? null
    : null;
  const baseList = dragId ? slides.filter((s) => s.id !== dragId) : slides;
  const projected =
    dragId && draggedSlide && insertIndex != null
      ? [
          ...baseList.slice(0, insertIndex),
          draggedSlide,
          ...baseList.slice(insertIndex),
        ]
      : slides;

  React.useLayoutEffect(() => {
    if (!dragId) return;

    const newRects = new Map<string, DOMRect>();

    for (const slide of projected) {
      if (slide.id === dragId) continue;
      const el = chipRefs.current.get(slide.id);
      if (!el) continue;

      const newRect = el.getBoundingClientRect();
      newRects.set(slide.id, newRect);

      const prevRect = prevRects.current.get(slide.id);
      if (prevRect) {
        const dx = prevRect.left - newRect.left;
        const dy = prevRect.top - newRect.top;
        if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
          el.style.transition = "none";
          el.style.transform = `translate(${dx}px, ${dy}px)`;
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              el.style.transition = "transform 150ms ease";
              el.style.transform = "";
            });
          });
        }
      }
    }

    prevRects.current = newRects;
  }, [projected, dragId]);

  const clearDrag = () => {
    if (animFrameRef.current != null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    clearChipTransforms(chipRefs);
    prevRects.current = new Map();
    setDragId(null);
    setInsertIndex(null);
    droppedRef.current = false;
  };

  const commitReorder = () => {
    if (dragId != null && insertIndex != null) {
      droppedRef.current = true;
      onReorder(dragId, insertIndex);
    }
    clearDrag();
  };

  const setInsertIndexFromDrag = (nextIndex: number) => {
    if (insertIndex === nextIndex) return;
    prevRects.current = captureChipRects(chipRefs, dragId);
    setInsertIndex(nextIndex);
  };

  if (slides.length <= 1) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-slate-500">Reihenfolge</span>
      <div
        className="flex flex-wrap items-center gap-1.5"
        onDragOver={(e) => {
          if (!dragId) return;
          e.preventDefault();
          setInsertIndexFromDrag(baseList.length);
        }}
        onDrop={(e) => {
          e.preventDefault();
          commitReorder();
        }}
      >
        {projected.map((slide, i) => {
          const isSelected = selectedId === slide.id;
          const isPlaceholder = dragId === slide.id;
          const chipIndexInBase = baseList.findIndex((s) => s.id === slide.id);

          return (
            <button
              key={slide.id}
              ref={(el) => {
                if (el) chipRefs.current.set(slide.id, el);
                else chipRefs.current.delete(slide.id);
              }}
              type="button"
              draggable={!isPlaceholder}
              onClick={() => {
                if (!isPlaceholder) onSelect(slide.id);
              }}
              onDragStart={(e) => {
                if (isPlaceholder) return;
                const startIndex = slides.findIndex((s) => s.id === slide.id);
                prevRects.current = captureChipRects(chipRefs);
                setDragId(slide.id);
                setInsertIndex(startIndex);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(e) => {
                if (!dragId || isPlaceholder) return;
                e.preventDefault();
                e.stopPropagation();
                const rect = e.currentTarget.getBoundingClientRect();
                setInsertIndexFromDrag(
                  insertIndexFromDragOver(e.clientX, rect, chipIndexInBase),
                );
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                commitReorder();
              }}
              onDragEnd={() => {
                if (!droppedRef.current) clearDrag();
              }}
              className={cn(
                "inline-flex h-8 min-w-8 shrink-0 items-center justify-center rounded-md px-2 text-sm font-medium",
                isPlaceholder
                  ? "cursor-grabbing border-2 border-dashed border-vdidBlue bg-vdidBlue/5 text-vdidBlue/40"
                  : "cursor-grab active:cursor-grabbing",
                !isPlaceholder &&
                  (isSelected
                    ? "bg-vdidBlue text-white"
                    : "border border-slate-200 bg-white text-slate-900 hover:border-slate-300"),
              )}
              aria-label={`Post ${i + 1}${isSelected ? ", ausgewählt" : ""}`}
              aria-current={isSelected ? "true" : undefined}
              title="Klicken zum Auswählen, ziehen zum Sortieren"
            >
              {i + 1}
            </button>
          );
        })}
      </div>
      {(onDuplicate || onDelete) && (
        <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
          {onDuplicate && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-xs text-slate-600"
              onClick={() => onDuplicate(selectedId)}
              aria-label="Post duplizieren"
              title="Duplizieren"
            >
              Duplizieren
            </Button>
          )}
          {onDelete && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-xs text-slate-600"
              disabled={slides.length <= 1}
              onClick={() => onDelete(selectedId)}
              aria-label="Post löschen"
              title="Löschen"
            >
              Löschen
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

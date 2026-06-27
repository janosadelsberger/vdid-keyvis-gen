"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import type { LabSlide } from "@/lib/lab-slide-render";
import { cn } from "@/lib/utils";

export type PostSlideOrderBarProps = {
  slides: LabSlide[];
  selectedId: string;
  onSelect: (id: string) => void;
  onReorder: (dragId: string, targetId: string) => void;
  onDuplicate?: (id: string) => void;
  onDelete?: (id: string) => void;
};

export function PostSlideOrderBar({
  slides,
  selectedId,
  onSelect,
  onReorder,
  onDuplicate,
  onDelete,
}: PostSlideOrderBarProps) {
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [dragOverId, setDragOverId] = React.useState<string | null>(null);

  const handleDrop = (targetId: string) => {
    if (dragId && dragId !== targetId) onReorder(dragId, targetId);
    setDragId(null);
    setDragOverId(null);
  };

  if (slides.length <= 1) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-slate-500">Reihenfolge</span>
      <div className="flex flex-wrap items-center gap-1.5">
        {slides.map((slide, i) => {
          const isSelected = selectedId === slide.id;
          const isDragOver = dragOverId === slide.id && dragId !== slide.id;
          return (
            <button
              key={slide.id}
              type="button"
              draggable
              onClick={() => onSelect(slide.id)}
              onDragStart={(e) => {
                setDragId(slide.id);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(e) => {
                e.preventDefault();
                if (dragOverId !== slide.id) setDragOverId(slide.id);
              }}
              onDrop={(e) => {
                e.preventDefault();
                handleDrop(slide.id);
              }}
              onDragEnd={() => {
                setDragId(null);
                setDragOverId(null);
              }}
              className={cn(
                "inline-flex h-8 min-w-8 cursor-grab items-center justify-center rounded-md px-2 text-sm font-medium transition-colors active:cursor-grabbing",
                isSelected
                  ? "bg-vdidBlue text-white"
                  : "border border-slate-200 bg-white text-slate-900 hover:border-slate-300",
                isDragOver && "ring-2 ring-vdidBlue ring-offset-1",
                dragId === slide.id && "opacity-50",
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

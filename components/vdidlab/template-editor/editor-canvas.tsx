"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import {
  createDefaultElement,
  ELEMENT_KIND_LABELS,
  getTemplateGuides,
  normalizeGuides,
  TEMPLATE_EDITOR_WIDTH_PX,
  type CustomTemplate,
  type DefaultElementTheme,
  type NormalizedBox,
  type TemplateElement,
  type TemplateGuides,
} from "@/lib/custom-template";
import { resizeSquareLogoBox } from "@/lib/lab-layout";
import { renderCustomTemplateSampleToContext } from "@/lib/custom-template-render";
import {
  type ActiveSnapLines,
  type SnapLock,
  SNAP_THRESHOLD_PX,
  snapBoxMove,
  snapBoxResize,
  thresholdFromPx,
} from "@/lib/editor-snap";
import type { RenderAssets } from "@/lib/lab-slide-render";
import {
  EditorRulers,
  type GuideDrag,
  type SelectedGuide,
} from "@/components/vdidlab/template-editor/editor-rulers";
import { cn } from "@/lib/utils";

const EDITOR_WIDTH = TEMPLATE_EDITOR_WIDTH_PX;

export type EditorCanvasProps = {
  template: CustomTemplate;
  assets: RenderAssets;
  selectedElementId: string | null;
  onSelectElement: (id: string | null) => void;
  onUpdateTemplate: (template: CustomTemplate) => void;
  defaultElementTheme?: DefaultElementTheme;
};

type ElementDragMode = {
  type: "move" | "resize";
  id: string;
  startX: number;
  startY: number;
  startBox: NormalizedBox;
  snapLocks?: { x?: SnapLock; y?: SnapLock };
};

type GuideMoveMode = {
  orientation: "vertical" | "horizontal";
  index: number;
};

export function EditorCanvas({
  template,
  assets,
  selectedElementId,
  onSelectElement,
  onUpdateTemplate,
  defaultElementTheme,
}: EditorCanvasProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const canvasAreaRef = React.useRef<HTMLDivElement>(null);
  const elementDragRef = React.useRef<ElementDragMode | null>(null);
  const guideMoveRef = React.useRef<GuideMoveMode | null>(null);

  const [selectedGuide, setSelectedGuide] = React.useState<SelectedGuide | null>(
    null,
  );
  const [guideDrag, setGuideDrag] = React.useState<GuideDrag | null>(null);
  const [activeSnapLines, setActiveSnapLines] = React.useState<ActiveSnapLines>(
    {},
  );

  const guides = getTemplateGuides(template);
  const height = Math.round(EDITOR_WIDTH / template.baseAspect);

  React.useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = EDITOR_WIDTH;
    canvas.height = height;
    renderCustomTemplateSampleToContext(
      ctx,
      template,
      { width: EDITOR_WIDTH, height },
      assets,
    );
  }, [template, assets, height]);

  React.useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== "Delete" && ev.key !== "Backspace") return;
      if (!selectedGuide) return;
      const target = ev.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT"
      ) {
        return;
      }
      ev.preventDefault();
      removeGuide(selectedGuide);
      setSelectedGuide(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedGuide, guides]);

  const updateGuides = (next: TemplateGuides) => {
    onUpdateTemplate({
      ...template,
      guides: normalizeGuides(next),
    });
  };

  const removeGuide = (sel: SelectedGuide) => {
    if (sel.orientation === "vertical") {
      updateGuides({
        ...guides,
        vertical: guides.vertical.filter((_, i) => i !== sel.index),
      });
    } else {
      updateGuides({
        ...guides,
        horizontal: guides.horizontal.filter((_, i) => i !== sel.index),
      });
    }
  };

  const pointerToNorm = (clientX: number, clientY: number) => {
    const rect = canvasAreaRef.current?.getBoundingClientRect();
    if (!rect) return { nx: 0, ny: 0 };
    return {
      nx: Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)),
      ny: Math.min(1, Math.max(0, (clientY - rect.top) / rect.height)),
    };
  };

  const updateElement = (id: string, patch: Partial<TemplateElement>) => {
    onUpdateTemplate({
      ...template,
      elements: template.elements.map((el) =>
        el.id === id ? ({ ...el, ...patch } as TemplateElement) : el,
      ),
    });
  };

  const onElementPointerDown = (
    e: React.PointerEvent,
    el: TemplateElement,
    mode: "move" | "resize",
  ) => {
    e.stopPropagation();
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    onSelectElement(el.id);
    setSelectedGuide(null);
    elementDragRef.current = {
      type: mode,
      id: el.id,
      startX: e.clientX,
      startY: e.clientY,
      startBox: { ...el.box },
      snapLocks: {},
    };
    setActiveSnapLines({});
  };

  const onElementPointerMove = (e: React.PointerEvent) => {
    const drag = elementDragRef.current;
    if (!drag) return;
    const rect = canvasAreaRef.current?.getBoundingClientRect();
    if (!rect) return;

    const thresholdX = thresholdFromPx(SNAP_THRESHOLD_PX, rect.width);
    const thresholdY = thresholdFromPx(SNAP_THRESHOLD_PX, rect.height);
    const dx = (e.clientX - drag.startX) / rect.width;
    const dy = (e.clientY - drag.startY) / rect.height;
    const { startBox } = drag;

    if (drag.type === "move") {
      const proposed: NormalizedBox = {
        ...startBox,
        x: Math.min(1 - startBox.w, Math.max(0, startBox.x + dx)),
        y: Math.min(1 - startBox.h, Math.max(0, startBox.y + dy)),
      };
      const snapped = snapBoxMove(
        proposed,
        guides,
        thresholdX,
        thresholdY,
        drag.snapLocks,
      );
      elementDragRef.current = { ...drag, snapLocks: snapped.locks };
      setActiveSnapLines(snapped.activeLines);
      updateElement(drag.id, { box: snapped.box });
    } else {
      const proposed: NormalizedBox = {
        ...startBox,
        w: Math.min(1 - startBox.x, Math.max(0.02, startBox.w + dx)),
        h: Math.min(1 - startBox.y, Math.max(0.02, startBox.h + dy)),
      };
      const snapped = snapBoxResize(
        proposed,
        guides,
        thresholdX,
        thresholdY,
        drag.snapLocks,
      );
      elementDragRef.current = { ...drag, snapLocks: snapped.locks };
      setActiveSnapLines(snapped.activeLines);
      const el = template.elements.find((e) => e.id === drag.id);
      const nextBox =
        el?.kind === "logo"
          ? resizeSquareLogoBox(snapped.box, template.baseAspect)
          : snapped.box;
      updateElement(drag.id, { box: nextBox });
    }
  };

  const onElementPointerUp = () => {
    elementDragRef.current = null;
    setActiveSnapLines({});
  };

  const onStartGuideFromRuler = (
    orientation: "vertical" | "horizontal",
    clientX: number,
    clientY: number,
  ) => {
    const { nx, ny } = pointerToNorm(clientX, clientY);
    setGuideDrag({
      orientation,
      position: orientation === "vertical" ? nx : ny,
    });
    setSelectedGuide(null);
    onSelectElement(null);
  };

  const onGuideDragMove = (clientX: number, clientY: number) => {
    if (!guideDrag) return;
    const { nx, ny } = pointerToNorm(clientX, clientY);
    setGuideDrag({
      orientation: guideDrag.orientation,
      position: guideDrag.orientation === "vertical" ? nx : ny,
    });
  };

  const onGuideDragEnd = (clientX: number, clientY: number) => {
    if (!guideDrag) return;
    const { nx, ny } = pointerToNorm(clientX, clientY);
    const pos = guideDrag.orientation === "vertical" ? nx : ny;

    if (guideMoveRef.current) {
      const { orientation, index } = guideMoveRef.current;
      if (orientation === "vertical") {
        if (nx < 0.02) {
          updateGuides({
            ...guides,
            vertical: guides.vertical.filter((_, i) => i !== index),
          });
        } else {
          const vertical = [...guides.vertical];
          vertical[index] = pos;
          updateGuides({ ...guides, vertical });
        }
      } else if (ny < 0.02) {
        updateGuides({
          ...guides,
          horizontal: guides.horizontal.filter((_, i) => i !== index),
        });
      } else {
        const horizontal = [...guides.horizontal];
        horizontal[index] = pos;
        updateGuides({ ...guides, horizontal });
      }
      guideMoveRef.current = null;
    } else if (pos > 0.02 && pos < 0.98) {
      if (guideDrag.orientation === "vertical") {
        updateGuides({
          ...guides,
          vertical: [...guides.vertical, pos],
        });
      } else {
        updateGuides({
          ...guides,
          horizontal: [...guides.horizontal, pos],
        });
      }
    }

    setGuideDrag(null);
  };

  const onGuidePointerDown = (
    e: React.PointerEvent,
    orientation: "vertical" | "horizontal",
    index: number,
  ) => {
    e.stopPropagation();
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    guideMoveRef.current = { orientation, index };
    setSelectedGuide({ orientation, index });
    onSelectElement(null);
    setGuideDrag({
      orientation,
      position:
        orientation === "vertical"
          ? guides.vertical[index]
          : guides.horizontal[index],
    });
  };

  const addElement = (kind: TemplateElement["kind"]) => {
    const el = createDefaultElement(
      kind,
      template.baseAspect,
      defaultElementTheme,
    );
    onUpdateTemplate({
      ...template,
      elements: [...template.elements, el],
    });
    onSelectElement(el.id);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1">
        {(Object.keys(ELEMENT_KIND_LABELS) as TemplateElement["kind"][]).map(
          (kind) => (
            <Button
              key={kind}
              type="button"
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              onClick={() => addElement(kind)}
            >
              + {ELEMENT_KIND_LABELS[kind]}
            </Button>
          ),
        )}
      </div>

      <p className="text-xs text-slate-500">
        Hilfslinien vom Lineal in die Fläche ziehen. Elemente rasten beim
        Verschieben ein. Hilfslinie zurück ins Lineal oder Entf löschen.
      </p>

      <EditorRulers
        guides={guides}
        selectedGuide={selectedGuide}
        guideDrag={guideDrag}
        activeSnapLines={activeSnapLines}
        canvasRef={canvasAreaRef}
        onSelectGuide={setSelectedGuide}
        onStartGuideFromRuler={onStartGuideFromRuler}
        onGuideDragMove={onGuideDragMove}
        onGuideDragEnd={onGuideDragEnd}
        onGuidePointerDown={onGuidePointerDown}
      >
        <div
          ref={canvasAreaRef}
          className="relative h-full w-full"
          style={{ aspectRatio: `${template.baseAspect}` }}
          onPointerMove={(e) => {
            onElementPointerMove(e);
            if (guideDrag) onGuideDragMove(e.clientX, e.clientY);
          }}
          onPointerUp={(e) => {
            onElementPointerUp();
            if (guideDrag) onGuideDragEnd(e.clientX, e.clientY);
          }}
          onPointerLeave={(e) => {
            onElementPointerUp();
            if (guideDrag) onGuideDragEnd(e.clientX, e.clientY);
          }}
          onClick={() => {
            onSelectElement(null);
            setSelectedGuide(null);
          }}
        >
          <canvas
            ref={canvasRef}
            className="block h-full w-full rounded-md border border-slate-200"
          />
          {template.elements.map((el) => {
            const selected = el.id === selectedElementId;
            const left = `${el.box.x * 100}%`;
            const top = `${el.box.y * 100}%`;
            const width = `${el.box.w * 100}%`;
            const heightPct = `${el.box.h * 100}%`;
            return (
              <div
                key={el.id}
                className={cn(
                  "absolute z-10 border-2",
                  selected
                    ? "border-vdidBlue"
                    : "border-transparent hover:border-vdidBlue/40",
                )}
                style={{ left, top, width, height: heightPct }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectElement(el.id);
                  setSelectedGuide(null);
                }}
                onPointerDown={(e) => onElementPointerDown(e, el, "move")}
              >
                <div
                  className="absolute bottom-0 right-0 z-10 h-3 w-3 cursor-se-resize rounded-sm bg-vdidBlue"
                  onPointerDown={(e) => onElementPointerDown(e, el, "resize")}
                />
              </div>
            );
          })}
        </div>
      </EditorRulers>
    </div>
  );
}

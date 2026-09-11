"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import type {
  CustomTemplate,
  NormalizedBox,
  TemplateElement,
} from "@/lib/custom-template";
import {
  ELEMENT_KIND_LABELS,
  TEMPLATE_IMAGE_SLOT_OPTIONS,
  TEMPLATE_TEXT_FIELD_OPTIONS,
  boxToPixels,
  isKnownImageSlotId,
  isKnownTextFieldId,
  pixelsToBox,
} from "@/lib/custom-template";

const selectClassName =
  "flex h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100";

export type ElementPropertiesProps = {
  element: TemplateElement | null;
  canvasWidthPx: number;
  canvasHeightPx: number;
  onChange: (element: TemplateElement) => void;
};

function BoxFields({
  box,
  canvasWidthPx,
  canvasHeightPx,
  lockSquare,
  onChange,
}: {
  box: NormalizedBox;
  canvasWidthPx: number;
  canvasHeightPx: number;
  lockSquare?: boolean;
  onChange: (box: NormalizedBox) => void;
}) {
  const px = boxToPixels(box, canvasWidthPx, canvasHeightPx);
  const fields = [
    { key: "x" as const, label: "X (px)" },
    { key: "y" as const, label: "Y (px)" },
    { key: "w" as const, label: "Breite (px)" },
    { key: "h" as const, label: "Höhe (px)" },
  ];

  const updatePx = (key: keyof typeof px, raw: string) => {
    const value = Number(raw);
    if (!Number.isFinite(value)) return;
    const next = { ...px, [key]: value };
    if (lockSquare && (key === "w" || key === "h")) {
      next.w = value;
      next.h = value;
    }
    onChange(pixelsToBox(next, canvasWidthPx, canvasHeightPx));
  };

  return (
    <div className="grid grid-cols-2 gap-2">
      {fields.map(({ key, label }) => (
        <div key={key} className="space-y-1">
          <Label className="text-xs">{label}</Label>
          <Input
            type="number"
            step={1}
            min={0}
            value={Math.round(px[key])}
            onChange={(e) => updatePx(key, e.target.value)}
          />
        </div>
      ))}
    </div>
  );
}

function FieldIdSelect({
  value,
  options,
  isKnown,
  onSelect,
  onCustomChange,
}: {
  value: string;
  options: readonly { id: string; label: string }[];
  isKnown: (id: string) => boolean;
  onSelect: (id: string) => void;
  onCustomChange: (id: string) => void;
}) {
  const custom = !isKnown(value);

  return (
    <div className="space-y-2">
      <select
        className={selectClassName}
        value={custom ? "__custom__" : value}
        onChange={(e) => {
          const next = e.target.value;
          if (next !== "__custom__") onSelect(next);
        }}
      >
        {options.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.label}
          </option>
        ))}
        <option value="__custom__">Benutzerdefiniert…</option>
      </select>
      {custom && (
        <Input
          value={value}
          placeholder="Eigene Feld-ID"
          onChange={(e) => onCustomChange(e.target.value)}
        />
      )}
    </div>
  );
}

export function ElementProperties({
  element,
  canvasWidthPx,
  canvasHeightPx,
  onChange,
}: ElementPropertiesProps) {
  if (!element) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Element auswählen oder neues hinzufügen.
      </p>
    );
  }

  const patch = (partial: Partial<TemplateElement>) =>
    onChange({ ...element, ...partial } as TemplateElement);

  const patchBox = (box: NormalizedBox) => patch({ box } as Partial<TemplateElement>);

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
        {ELEMENT_KIND_LABELS[element.kind]}
      </p>

      <BoxFields
        box={element.box}
        canvasWidthPx={canvasWidthPx}
        canvasHeightPx={canvasHeightPx}
        lockSquare={element.kind === "logo"}
        onChange={patchBox}
      />

      {element.kind === "text" && (
        <>
          <div className="space-y-1">
            <Label className="text-xs">Feld-Verbindung</Label>
            <FieldIdSelect
              value={element.field}
              options={TEMPLATE_TEXT_FIELD_OPTIONS}
              isKnown={isKnownTextFieldId}
              onSelect={(fieldId) => {
                const preset = TEMPLATE_TEXT_FIELD_OPTIONS.find(
                  (o) => o.id === fieldId,
                );
                onChange({
                  ...element,
                  field: fieldId,
                  label: preset?.elementLabel ?? element.label,
                  defaultText: preset?.defaultText ?? element.defaultText,
                });
              }}
              onCustomChange={(field) =>
                patch({ field } as Partial<TemplateElement>)
              }
            />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Verknüpft mit dem gleichnamigen Eingabefeld im Generator.
            </p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Label</Label>
            <Input
              value={element.label}
              onChange={(e) => patch({ label: e.target.value } as Partial<TemplateElement>)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Standardtext</Label>
            <Input
              value={element.defaultText}
              onChange={(e) =>
                patch({ defaultText: e.target.value } as Partial<TemplateElement>)
              }
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Schriftgröße (Anteil Höhe)</Label>
            <Input
              type="number"
              step={0.005}
              min={0.01}
              max={0.2}
              value={element.style.heightFraction}
              onChange={(e) =>
                onChange({
                  ...element,
                  style: {
                    ...element.style,
                    heightFraction: Number(e.target.value),
                  },
                })
              }
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="autoFit"
              checked={element.style.autoFit}
              onChange={(e) =>
                onChange({
                  ...element,
                  style: { ...element.style, autoFit: e.target.checked },
                })
              }
            />
            <Label htmlFor="autoFit" className="cursor-pointer text-xs">
              Auto-Anpassung
            </Label>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Ausrichtung</Label>
            <select
              className={selectClassName}
              value={element.style.align}
              onChange={(e) =>
                onChange({
                  ...element,
                  style: {
                    ...element.style,
                    align: e.target.value as "left" | "right",
                  },
                })
              }
            >
              <option value="left">Links</option>
              <option value="right">Rechts</option>
            </select>
          </div>
        </>
      )}

      {(element.kind === "image" || element.kind === "partnerLogo") && (
        <>
          <div className="space-y-1">
            <Label className="text-xs">Bild-Slot</Label>
            <FieldIdSelect
              value={element.slot}
              options={TEMPLATE_IMAGE_SLOT_OPTIONS}
              isKnown={isKnownImageSlotId}
              onSelect={(slotId) => {
                const preset = TEMPLATE_IMAGE_SLOT_OPTIONS.find(
                  (o) => o.id === slotId,
                );
                onChange({
                  ...element,
                  slot: slotId,
                  label: preset?.elementLabel ?? element.label,
                });
              }}
              onCustomChange={(slot) =>
                patch({ slot } as Partial<TemplateElement>)
              }
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Label</Label>
            <Input
              value={element.label}
              onChange={(e) => patch({ label: e.target.value } as Partial<TemplateElement>)}
            />
          </div>
        </>
      )}

      {element.kind === "logo" && (
        <div className="space-y-1">
          <Label className="text-xs">Variante</Label>
          <select
            className={selectClassName}
            value={element.variant}
            onChange={(e) =>
              onChange({
                ...element,
                variant: e.target.value as "auto" | "dark" | "white",
              })
            }
          >
            <option value="auto">Automatisch</option>
            <option value="dark">Dunkel</option>
            <option value="white">Weiß</option>
          </select>
        </div>
      )}

      {element.kind === "rect" && (
        <>
          <div className="space-y-1">
            <Label className="text-xs">Farbe</Label>
            <Input
              type="color"
              value={element.fill}
              onChange={(e) =>
                onChange({ ...element, fill: e.target.value })
              }
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Deckkraft</Label>
            <Input
              type="number"
              step={0.1}
              min={0}
              max={1}
              value={element.opacity}
              onChange={(e) =>
                onChange({ ...element, opacity: Number(e.target.value) })
              }
            />
          </div>
        </>
      )}

      {element.kind === "line" && (
        <>
          <div className="space-y-1">
            <Label className="text-xs">Farbe</Label>
            <Input
              type="color"
              value={element.color}
              onChange={(e) =>
                onChange({ ...element, color: e.target.value })
              }
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Stärke (Anteil Höhe)</Label>
            <Input
              type="number"
              step={0.001}
              min={0.001}
              max={0.05}
              value={element.thicknessFraction}
              onChange={(e) =>
                onChange({
                  ...element,
                  thicknessFraction: Number(e.target.value),
                })
              }
            />
          </div>
        </>
      )}
    </div>
  );
}

export type TemplateMetaFieldsProps = {
  template: CustomTemplate;
  onChange: (template: CustomTemplate) => void;
};

export function TemplateMetaFields({ template, onChange }: TemplateMetaFieldsProps) {
  return (
    <div className="space-y-3 border-b border-slate-200 pb-4 dark:border-slate-700">
      <div className="space-y-1">
        <Label className="text-xs">Vorlagenname</Label>
        <Input
          value={template.name}
          onChange={(e) => onChange({ ...template, name: e.target.value })}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Hintergrund</Label>
        <Input
          type="color"
          value={template.backgroundColor}
          onChange={(e) =>
            onChange({ ...template, backgroundColor: e.target.value })
          }
        />
      </div>
    </div>
  );
}

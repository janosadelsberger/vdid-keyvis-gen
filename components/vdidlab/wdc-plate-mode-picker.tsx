"use client";

import React from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  WDC_PLATE_MODE_LABELS,
  WDC_PLATE_MODES,
  parseWdcPlateMode,
  type WdcPlateMode,
} from "@/lib/wdc-theme";

export function WdcPlateModePicker({
  value,
  onChange,
}: {
  value: WdcPlateMode | undefined;
  onChange: (mode: WdcPlateMode) => void;
}) {
  const mode = parseWdcPlateMode(value);
  return (
    <div className="space-y-2 md:col-span-2">
      <Label>Hintergrund</Label>
      <div
        role="radiogroup"
        aria-label="Hintergrund"
        className="grid gap-2 sm:grid-cols-3"
      >
        {WDC_PLATE_MODES.map((key) => {
          const selected = mode === key;
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(key)}
              className={cn(
                "rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors",
                selected
                  ? "border-vdidBlue bg-blue-50 text-slate-900"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
              )}
            >
              {WDC_PLATE_MODE_LABELS[key]}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-slate-500">
        Animiert braucht die Videoplatte und wird als GIF/MP4 mit exportiert,
        wenn Animation angehakt ist. Still ist dasselbe Bild ohne Bewegung —
        gleicher Ausschnitt wie die Animation. Close-up ist das Standbild
        unter public/wdc-bg.png.
      </p>
    </div>
  );
}

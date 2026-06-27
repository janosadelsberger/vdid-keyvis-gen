"use client";

import React from "react";
import { cn } from "@/lib/utils";
import type { SlideType } from "@/lib/lab-slide-render";

export const SLIDE_TYPES_ORDER: SlideType[] = [
  "eventPhoto",
  "title",
  "quote",
  "cta",
  "coBranded",
  "freeform",
];

export const SLIDE_TYPE_LABELS: Record<SlideType, string> = {
  title: "Titel + Datum",
  quote: "Zitat / Testimonial",
  cta: "Call-to-Action",
  eventPhoto: "Event mit Foto",
  coBranded: "Co-Branding",
  freeform: "Freitext",
};

export const SLIDE_TYPE_CAPTIONS: Record<SlideType, string> = {
  eventPhoto:
    "Formatzeile, Titel, Datum und großes Foto — für Events, Vorträge und Termine mit Bild.",
  title:
    "Fortbildungs-Layout mit Formatzeile, großem Titel und Datum — ohne Bildfläche.",
  quote:
    "Titel plus Zitat mit optional blauen Highlights, Name und Rolle unten rechts.",
  cta:
    "Titel, Text und Kontaktzeile — z. B. für Anmeldungen und Aktionen.",
  coBranded:
    "Wie Event mit Foto, plus Partner-Logo unten rechts — für Kooperationen.",
  freeform:
    "Flexibles Layout mit optionaler Formatzeile, Titel, Text, Foto und Name.",
};

const WF = {
  bg: "#F0F0F0",
  text: "#9A9A9A",
  muted: "#C4C4C4",
  photo: "#D6D6D6",
  logo: "#2B2B2B",
  blue: "#0A2CD9",
};

const W = 80;
const H = 100;
const P = 8;

type Rect = {
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
  r?: number;
};

function Bar({ x, y, w, h, fill, r = 1.2 }: Rect) {
  return <rect x={x} y={y} width={w} height={h} rx={r} fill={fill} />;
}

/** VDID lockup stand-in: square mark + wordmark line, bottom-left. */
function logoMarks(): Rect[] {
  const y = H - P - 11;
  return [
    { x: P, y, w: 8, h: 8, fill: WF.logo, r: 0.8 },
    { x: P, y: H - P - 2, w: 13, h: 2, fill: WF.logo, r: 0.8 },
  ];
}

function attributionMarks(): Rect[] {
  return [
    { x: W - P - 22, y: H - P - 10, w: 22, h: 3, fill: WF.text },
    { x: W - P - 15, y: H - P - 4, w: 15, h: 2.5, fill: WF.muted },
  ];
}

function wireframeRects(type: SlideType): Rect[] {
  switch (type) {
    case "title":
      return [
        { x: P, y: P, w: 24, h: 2.5, fill: WF.muted },
        { x: P, y: 20, w: 52, h: 6, fill: WF.text },
        { x: P, y: 30, w: 60, h: 6, fill: WF.text },
        { x: P, y: 40, w: 42, h: 6, fill: WF.text },
        { x: P, y: 54, w: 30, h: 3, fill: WF.muted },
        ...logoMarks(),
      ];
    case "eventPhoto":
      return [
        { x: P, y: P, w: 24, h: 2.5, fill: WF.muted },
        { x: P, y: 15, w: 50, h: 4.5, fill: WF.text },
        { x: P, y: 22, w: 38, h: 4.5, fill: WF.text },
        { x: P, y: 31, w: 26, h: 2.5, fill: WF.muted },
        { x: P, y: 38, w: W - 2 * P, h: 39, fill: WF.photo, r: 2 },
        ...logoMarks(),
        { x: W - P - 18, y: H - P - 4, w: 18, h: 2.5, fill: WF.text },
      ];
    case "quote":
      return [
        { x: P, y: P, w: 40, h: 3, fill: WF.muted },
        { x: P, y: 22, w: 20, h: 5, fill: WF.blue },
        { x: 30, y: 22, w: 34, h: 5, fill: WF.text },
        { x: P, y: 31, w: 56, h: 5, fill: WF.text },
        { x: P, y: 40, w: 46, h: 5, fill: WF.text },
        ...attributionMarks(),
        ...logoMarks(),
      ];
    case "cta":
      return [
        { x: P, y: 12, w: 52, h: 6, fill: WF.blue },
        { x: P, y: 22, w: 44, h: 6, fill: WF.blue },
        { x: P, y: 36, w: 58, h: 3, fill: WF.muted },
        { x: P, y: 42, w: 50, h: 3, fill: WF.muted },
        { x: W - P - 28, y: H - P - 10, w: 16, h: 3, fill: WF.muted },
        { x: W - P - 11, y: H - P - 10, w: 11, h: 3, fill: WF.blue },
        ...logoMarks(),
      ];
    case "coBranded":
      return [
        { x: P, y: P, w: 24, h: 2.5, fill: WF.muted },
        { x: P, y: 15, w: 50, h: 4.5, fill: WF.text },
        { x: P, y: 22, w: 38, h: 4.5, fill: WF.text },
        { x: P, y: 31, w: 26, h: 2.5, fill: WF.muted },
        { x: P, y: 38, w: W - 2 * P, h: 33, fill: WF.photo, r: 2 },
        ...logoMarks(),
        { x: W - P - 16, y: H - P - 11, w: 16, h: 9, fill: WF.muted, r: 1 },
      ];
    case "freeform":
      return [
        { x: P, y: P, w: 24, h: 2.5, fill: WF.muted },
        { x: P, y: 15, w: 46, h: 4.5, fill: WF.text },
        { x: P, y: 24, w: 58, h: 3, fill: WF.muted },
        { x: P, y: 30, w: 50, h: 3, fill: WF.muted },
        { x: P, y: 38, w: W - 2 * P, h: 31, fill: WF.photo, r: 2 },
        ...logoMarks(),
        { x: W - P - 18, y: H - P - 4, w: 18, h: 2.5, fill: WF.text },
      ];
    default:
      return [];
  }
}

function TemplateWireframe({ type }: { type: SlideType }) {
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-full w-full"
      role="img"
      aria-hidden
    >
      <rect x="0" y="0" width={W} height={H} rx="3" fill={WF.bg} />
      {wireframeRects(type).map((r, i) => (
        <Bar key={i} {...r} />
      ))}
    </svg>
  );
}

export type SlideTemplatePickerProps = {
  value: SlideType;
  onChange: (type: SlideType) => void;
  id?: string;
};

export function SlideTemplatePicker({
  value,
  onChange,
  id = "slide-template",
}: SlideTemplatePickerProps) {
  return (
    <div className="space-y-3">
      <div
        role="radiogroup"
        aria-label="Vorlage wählen"
        className="grid grid-cols-3 gap-2 sm:grid-cols-6 md:grid-cols-3 lg:grid-cols-6"
      >
        {SLIDE_TYPES_ORDER.map((type) => {
          const selected = type === value;
          return (
            <button
              key={type}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-controls={`${id}-caption`}
              onClick={() => onChange(type)}
              className={cn(
                "group flex flex-col items-center gap-1.5 rounded-lg border p-1.5 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vdidBlue focus-visible:ring-offset-1",
                selected
                  ? "border-vdidBlue ring-2 ring-vdidBlue/30"
                  : "border-slate-200 hover:border-slate-400",
              )}
            >
              <span
                className={cn(
                  "block w-full overflow-hidden rounded-md ring-1 transition-shadow",
                  selected ? "ring-vdidBlue/40" : "ring-slate-200",
                )}
              >
                <TemplateWireframe type={type} />
              </span>
              <span
                className={cn(
                  "text-[11px] leading-tight",
                  selected
                    ? "font-medium text-vdidBlue"
                    : "text-slate-600 group-hover:text-slate-900",
                )}
              >
                {SLIDE_TYPE_LABELS[type]}
              </span>
            </button>
          );
        })}
      </div>

      <p
        id={`${id}-caption`}
        aria-live="polite"
        className="text-sm leading-relaxed text-slate-600"
      >
        <span className="font-medium text-slate-900">
          {SLIDE_TYPE_LABELS[value]}
        </span>
        {" — "}
        {SLIDE_TYPE_CAPTIONS[value]}
      </p>
    </div>
  );
}

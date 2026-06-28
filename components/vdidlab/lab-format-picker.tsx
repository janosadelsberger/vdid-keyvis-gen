"use client";

import React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { LabFormatKey } from "@/lib/lab-formats";
import { LAB_FORMAT_KEYS } from "@/lib/lab-formats";

type FormatThumbSpec = {
  width: number;
  height: number;
  shortLabel: string;
  ariaLabel: string;
};

const FORMAT_THUMBS: Record<LabFormatKey, FormatThumbSpec> = {
  instagramPost: {
    width: 1080,
    height: 1350,
    shortLabel: "IG Post",
    ariaLabel: "Instagram Post 1080×1350",
  },
  instagramStory: {
    width: 1080,
    height: 1920,
    shortLabel: "IG Story",
    ariaLabel: "Instagram Story 1080×1920",
  },
  linkedin: {
    width: 1080,
    height: 1080,
    shortLabel: "LinkedIn",
    ariaLabel: "LinkedIn Post 1080×1080",
  },
  pdf: {
    width: 1080,
    height: 1080,
    shortLabel: "PDF",
    ariaLabel: "PDF Carousel 1080×1080",
  },
};

const THUMB_HEIGHT = 76;

function FormatThumbnail({
  formatKey,
  spec,
}: {
  formatKey: LabFormatKey;
  spec: FormatThumbSpec;
}) {
  const isStory = spec.height / spec.width > 1.5;

  if (formatKey === "pdf") {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-md bg-[#F0F0F0] text-sm font-bold text-vdidBlue">
        PDF
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex h-full w-full flex-col items-center justify-center rounded-md bg-[#F0F0F0] text-slate-600 leading-none",
        isStory ? "text-[8px] font-semibold" : "text-[10px] font-medium",
      )}
    >
      <span>{spec.width}</span>
      <span className="my-0.5 text-[7px] font-normal opacity-60">×</span>
      <span>{spec.height}</span>
    </div>
  );
}

export type LabFormatPickerProps = {
  enabled: Record<LabFormatKey, boolean>;
  onToggle: (key: LabFormatKey, checked: boolean) => void;
};

export function LabFormatPicker({ enabled, onToggle }: LabFormatPickerProps) {
  return (
    <div className="flex flex-wrap gap-3">
      {LAB_FORMAT_KEYS.map((key) => {
        const spec = FORMAT_THUMBS[key];
        const isOn = enabled[key];
        const thumbWidth = Math.round(THUMB_HEIGHT * (spec.width / spec.height));

        return (
          <label
            key={key}
            htmlFor={`lab-format-${key}`}
            className={cn(
              "group flex w-fit shrink-0 cursor-pointer flex-col items-center gap-2 rounded-lg border p-2 transition-colors",
              isOn
                ? "border-vdidBlue/50 bg-blue-50/60 ring-1 ring-vdidBlue/20"
                : "border-slate-200 bg-white hover:border-slate-300",
            )}
          >
            <div
              className="relative overflow-hidden rounded-md border border-slate-200/80 shadow-sm"
              style={{
                width: thumbWidth,
                height: THUMB_HEIGHT,
              }}
            >
                <FormatThumbnail formatKey={key} spec={spec} />
                <Checkbox
                  id={`lab-format-${key}`}
                  checked={isOn}
                  onChange={(e) => onToggle(key, e.target.checked)}
                  className="absolute right-1 top-1 bg-white/90 shadow-sm"
                aria-label={spec.ariaLabel}
              />
            </div>
            <span className="text-[11px] font-medium text-slate-600">
              {spec.shortLabel}
            </span>
          </label>
        );
      })}
    </div>
  );
}

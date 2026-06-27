"use client";

import React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { type ImageEditSettings } from "@/lib/image-edit";

export type ImageEditControlsProps = {
  settings: ImageEditSettings;
  onChange: (settings: ImageEditSettings) => void;
  idPrefix?: string;
};

export function ImageEditControls({
  settings,
  onChange,
  idPrefix = "image-edit",
}: ImageEditControlsProps) {
  const patch = (partial: Partial<ImageEditSettings>) =>
    onChange({ ...settings, ...partial });

  return (
    <div className="space-y-2 border-t border-slate-200 pt-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-center gap-2">
          <Checkbox
            id={`${idPrefix}-overlay`}
            checked={settings.overlayEnabled}
            onChange={(e) => patch({ overlayEnabled: e.target.checked })}
          />
          <Label htmlFor={`${idPrefix}-overlay`} className="cursor-pointer">
            Abdunkeln
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id={`${idPrefix}-grayscale`}
            checked={settings.grayscaleEnabled}
            onChange={(e) => patch({ grayscaleEnabled: e.target.checked })}
          />
          <Label htmlFor={`${idPrefix}-grayscale`} className="cursor-pointer">
            Schwarzweiß
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id={`${idPrefix}-blueTint`}
            checked={settings.blueTintEnabled}
            onChange={(e) => patch({ blueTintEnabled: e.target.checked })}
          />
          <Label htmlFor={`${idPrefix}-blueTint`} className="cursor-pointer">
            VDID-Blau
          </Label>
        </div>
      </div>

      {settings.overlayEnabled && (
        <div className="flex max-w-md flex-col gap-1">
          <Label htmlFor={`${idPrefix}-overlayOpacity`} className="text-xs">
            Abdunkeln ({Math.round(settings.overlayOpacity * 100)}%)
          </Label>
          <input
            id={`${idPrefix}-overlayOpacity`}
            type="range"
            min={0}
            max={100}
            value={Math.round(settings.overlayOpacity * 100)}
            onChange={(e) =>
              patch({ overlayOpacity: Number(e.target.value) / 100 })
            }
            className="w-full accent-vdidBlue"
          />
        </div>
      )}

      {settings.blueTintEnabled && (
        <div className="flex max-w-md flex-col gap-1">
          <Label htmlFor={`${idPrefix}-blueTintOpacity`} className="text-xs">
            Blauton ({Math.round(settings.blueTintOpacity * 100)}%)
          </Label>
          <input
            id={`${idPrefix}-blueTintOpacity`}
            type="range"
            min={0}
            max={100}
            value={Math.round(settings.blueTintOpacity * 100)}
            onChange={(e) =>
              patch({ blueTintOpacity: Number(e.target.value) / 100 })
            }
            className="w-full accent-vdidBlue"
          />
        </div>
      )}
    </div>
  );
}

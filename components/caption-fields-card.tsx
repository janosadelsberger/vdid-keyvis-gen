"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  CAPTION_PERFORMANCE_COPY,
  CAPTION_SWEET_SPOT,
  type CaptionSet,
  type CaptionTipsPlatform,
} from "@/lib/captions";
import { cn } from "@/lib/utils";

function RequiredMark() {
  return (
    <span className="text-red-600" aria-hidden>
      {" "}
      *
    </span>
  );
}

function PerformanceTipsModal({
  platform,
  onClose,
}: {
  platform: CaptionTipsPlatform;
  onClose: () => void;
}) {
  const copy = CAPTION_PERFORMANCE_COPY[platform];

  return (
    <div
      className="fixed inset-0 z-[101] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="caption-performance-modal-title"
      onClick={onClose}
    >
      <div
        className="max-h-[min(85vh,720px)] w-full max-w-lg overflow-y-auto rounded-lg border border-slate-200 bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-100 pb-3">
          <h2
            id="caption-performance-modal-title"
            className="text-lg font-semibold leading-snug text-slate-900"
          >
            {copy.title}
          </h2>
        </div>
        <ul className="mt-4 list-disc space-y-2.5 pl-5 text-sm leading-relaxed text-slate-700">
          {copy.tips.map((item, idx) => (
            <li key={idx}>{item}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function CaptionFieldLabel({
  htmlFor,
  label,
  required,
  onOpenTips,
}: {
  htmlFor: string;
  label: string;
  required?: boolean;
  onOpenTips: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Label htmlFor={htmlFor}>
        {label}
        {required && <RequiredMark />}
      </Label>
      <button
        type="button"
        aria-label="Tipps für Reichweite und Performance anzeigen"
        aria-haspopup="dialog"
        className="inline-flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full border border-slate-300 bg-white text-[11px] font-semibold leading-none text-slate-600 shadow-sm hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-vdidBlue focus-visible:ring-offset-1"
        onClick={onOpenTips}
      >
        i
      </button>
    </div>
  );
}

function CharCount({
  value,
  softLimit,
}: {
  value: string;
  softLimit: number;
}) {
  const len = value.length;
  const over = len > softLimit;
  return (
    <p
      className={cn(
        "text-xs tabular-nums",
        over ? "font-medium text-red-700" : "text-slate-500",
      )}
      aria-live="polite"
    >
      {len} / {softLimit} Zeichen
    </p>
  );
}

export type CaptionFieldsCardProps = {
  captions: CaptionSet;
  onChange: (field: keyof CaptionSet, value: string) => void;
  onCopyPrompt: () => void;
  idPrefix?: string;
};

export function CaptionFieldsCard({
  captions,
  onChange,
  onCopyPrompt,
  idPrefix = "caption",
}: CaptionFieldsCardProps) {
  const [tipsModal, setTipsModal] = React.useState<CaptionTipsPlatform | null>(
    null,
  );

  React.useEffect(() => {
    if (!tipsModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setTipsModal(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tipsModal]);

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0 flex-1 space-y-1">
            <CardTitle>Captions</CardTitle>
            <p className="text-sm font-normal leading-snug text-slate-600">
              Begleittexte für die Kanäle — nicht auf der Grafik, nur für
              Veröffentlichung und ZIP (.txt).
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full shrink-0 sm:mt-0.5 sm:w-auto"
            onClick={onCopyPrompt}
            aria-label="Prompt in die Zwischenablage kopieren"
          >
            Prompt kopieren
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <CaptionFieldLabel
                htmlFor={`${idPrefix}-instagram`}
                label="Caption Instagram"
                required
                onOpenTips={() => setTipsModal("instagram")}
              />
              <Textarea
                id={`${idPrefix}-instagram`}
                value={captions.captionInstagram}
                onChange={(e) => onChange("captionInstagram", e.target.value)}
                placeholder="Post-Text / Bildunterschrift"
                rows={5}
                className="min-h-[100px] resize-y"
              />
              <CharCount
                value={captions.captionInstagram}
                softLimit={CAPTION_SWEET_SPOT.instagram}
              />
            </div>
            <div className="space-y-1">
              <CaptionFieldLabel
                htmlFor={`${idPrefix}-linkedin`}
                label="Caption LinkedIn"
                required
                onOpenTips={() => setTipsModal("linkedin")}
              />
              <Textarea
                id={`${idPrefix}-linkedin`}
                value={captions.captionLinkedIn}
                onChange={(e) => onChange("captionLinkedIn", e.target.value)}
                placeholder="Beitragstext für LinkedIn"
                rows={5}
                className="min-h-[100px] resize-y"
              />
              <CharCount
                value={captions.captionLinkedIn}
                softLimit={CAPTION_SWEET_SPOT.linkedin}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {tipsModal && (
        <PerformanceTipsModal
          platform={tipsModal}
          onClose={() => setTipsModal(null)}
        />
      )}
    </>
  );
}

"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { DownloadIcon } from "@/components/download-icon";
import { cn } from "@/lib/utils";

export type ZipExportPhase = "images" | "pdf" | "gif" | "video" | "zip";

export type MotionProgressValue = {
  done: number;
  total: number;
};

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      className={cn("h-4 w-4 shrink-0 animate-spin", className)}
      aria-hidden
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="2"
        className="opacity-25"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function progressPercent(progress: MotionProgressValue | null) {
  if (!progress || progress.total <= 0) return 0;
  return Math.min(100, Math.round((progress.done / progress.total) * 100));
}

export function useRafProgress(
  progressRef: React.MutableRefObject<MotionProgressValue>,
  active: boolean,
) {
  const [progress, setProgress] = React.useState<MotionProgressValue>(
    () => progressRef.current ?? { done: 0, total: 1 },
  );

  React.useEffect(() => {
    if (!active) {
      setProgress({ done: 0, total: 1 });
      return;
    }
    setProgress(progressRef.current);
    let raf = 0;
    const tick = () => {
      const next = progressRef.current;
      setProgress((prev) =>
        prev.done === next.done && prev.total === next.total ? prev : { ...next },
      );
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, progressRef]);

  return progress;
}

export function ExportProgressButton({
  busy,
  busyLabel,
  idleLabel,
  idleExtra,
  percent,
  started,
  disabled,
  onClick,
}: {
  busy: boolean;
  busyLabel: string;
  idleLabel: string;
  idleExtra?: React.ReactNode;
  percent: number;
  started: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      disabled={disabled || busy}
      onClick={onClick}
      aria-busy={busy}
      aria-live={busy ? "polite" : undefined}
      aria-label={busy ? busyLabel : idleLabel}
      className={cn(
        "relative min-w-[11.5rem] gap-1.5 overflow-hidden",
        busy && "pointer-events-none cursor-wait",
      )}
    >
      {busy && (
        <span
          className={cn(
            "pointer-events-none absolute inset-0 origin-left bg-white/20",
            started
              ? "transition-transform duration-150 ease-out"
              : "animate-pulse",
          )}
          style={{ transform: `scaleX(${started ? percent / 100 : 0.12})` }}
          aria-hidden
        />
      )}
      <span className="relative flex items-center gap-1.5">
        {busy ? <SpinnerIcon /> : <DownloadIcon />}
        {busy ? (
          <>
            {busyLabel}
            {started && (
              <span className="tabular-nums opacity-80">{percent}%</span>
            )}
          </>
        ) : (
          <>
            {idleLabel}
            {idleExtra}
          </>
        )}
      </span>
    </Button>
  );
}

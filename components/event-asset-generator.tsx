"use client";

import React from "react";
import { createPortal } from "react-dom";
import { format } from "date-fns";
import JSZip from "jszip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";
import { Checkbox } from "@/components/ui/checkbox";
import { publicFile } from "@/lib/public-file";
import { cn } from "@/lib/utils";

type EventFormState = {
  eventFormat: string;
  eventFormatCustom: string;
  /** Hauptzeile auf allen Bildern */
  title: string;
  /** Begleittexte (nicht auf dem Bild); Pflicht für ZIP */
  captionWebsite: string;
  captionInstagram: string;
  captionLinkedIn: string;
  subtitle: string;
  date: Date | null;
  time: string;
  place: string;
  isOnline: boolean;
  /** Pflicht: erscheint auf allen Bildern (unten), u. a. für ZIP */
  copyright: string;
};

const INITIAL_FORM_STATE: EventFormState = {
  eventFormat: "–",
  eventFormatCustom: "",
  title: "",
  captionWebsite: "",
  captionInstagram: "",
  captionLinkedIn: "",
  subtitle: "",
  date: null,
  time: "",
  place: "",
  isOnline: false,
  copyright: "",
};

const FORM_STORAGE_KEY = "vdid-asset-gen-form-v1";

type StoredFormV1 = Omit<EventFormState, "date"> & {
  dateIso: string | null;
};

function serializeForm(form: EventFormState): string {
  const payload: StoredFormV1 = {
    eventFormat: form.eventFormat,
    eventFormatCustom: form.eventFormatCustom,
    title: form.title,
    captionWebsite: form.captionWebsite,
    captionInstagram: form.captionInstagram,
    captionLinkedIn: form.captionLinkedIn,
    subtitle: form.subtitle,
    dateIso: form.date ? form.date.toISOString() : null,
    time: form.time,
    place: form.place,
    isOnline: form.isOnline,
    copyright: form.copyright,
  };
  return JSON.stringify(payload);
}

function parseStoredForm(raw: string): EventFormState | null {
  try {
    const o = JSON.parse(raw) as Partial<StoredFormV1>;
    if (typeof o !== "object" || o === null) return null;
    const dateRaw = o.dateIso;
    let date: Date | null = null;
    if (typeof dateRaw === "string" && dateRaw.length > 0) {
      const d = new Date(dateRaw);
      if (!Number.isNaN(d.getTime())) date = d;
    }
    return {
      eventFormat: typeof o.eventFormat === "string" ? o.eventFormat : "–",
      eventFormatCustom:
        typeof o.eventFormatCustom === "string" ? o.eventFormatCustom : "",
      title: typeof o.title === "string" ? o.title : "",
      captionWebsite:
        typeof o.captionWebsite === "string" ? o.captionWebsite : "",
      captionInstagram:
        typeof o.captionInstagram === "string" ? o.captionInstagram : "",
      captionLinkedIn:
        typeof o.captionLinkedIn === "string" ? o.captionLinkedIn : "",
      subtitle: typeof o.subtitle === "string" ? o.subtitle : "",
      date,
      time: typeof o.time === "string" ? o.time : "",
      place: typeof o.place === "string" ? o.place : "",
      isOnline: typeof o.isOnline === "boolean" ? o.isOnline : false,
      copyright: typeof o.copyright === "string" ? o.copyright : "",
    };
  } catch {
    return null;
  }
}

type FocalPoint = { x: number; y: number };

type BackgroundLoadState = "idle" | "loading" | "ready";

type FormatKey =
  | "websitePreview"
  | "websiteHeader"
  | "instagramGrid"
  | "instagramStory"
  | "linkedinSquare";

const FORMAT_CONFIG: Record<
  FormatKey,
  { label: string; width: number; height: number; includeMeta: boolean }
> = {
  websitePreview: {
    label: "Website Preview 800×800",
    width: 800,
    height: 800,
    includeMeta: false,
  },
  websiteHeader: {
    label: "Website Header 1920×800",
    width: 1920,
    height: 800,
    includeMeta: false,
  },
  instagramGrid: {
    label: "Instagram Grid 1080×1350",
    width: 1080,
    height: 1350,
    includeMeta: true,
  },
  instagramStory: {
    label: "Instagram Story 1080×1920",
    width: 1080,
    height: 1920,
    includeMeta: true,
  },
  linkedinSquare: {
    label: "LinkedIn 1080×1080",
    width: 1080,
    height: 1080,
    includeMeta: true,
  },
};

/** Third segment of `yymmdd_title_<slug>.png` export filenames */
const FORMAT_EXPORT_SLUG: Record<FormatKey, string> = {
  websitePreview: "Website-Preview-800x800",
  websiteHeader: "Website-Header-1920x800",
  instagramGrid: "Instagram-Grid-1080x1350",
  instagramStory: "Instagram-Story-1080x1920",
  linkedinSquare: "LinkedIn-1080x1080",
};

function sanitizeTitleForFilename(raw: string): string {
  const fallback = "event";
  const trimmed = raw.trim();
  if (!trimmed) return fallback;
  const cleaned = trimmed
    .replace(/[/\\?%*:|"<>]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 80);
  return cleaned || fallback;
}

/**
 * `yymmdd_title_format` without extension.
 * `downloadDate` must be **today** when the user triggers download — never the event date field.
 */
function exportAssetBasename(
  title: string,
  formatSlug: string,
  downloadDate: Date,
): string {
  const yymmdd = format(downloadDate, "yyMMdd");
  return `${yymmdd}_${sanitizeTitleForFilename(title)}_${formatSlug}`;
}

function RequiredMark() {
  return (
    <span className="text-red-600" aria-hidden>
      {" "}
      *
    </span>
  );
}

function InfoTip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        aria-label="Hinweis anzeigen"
        title={text}
        className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-slate-300 bg-white text-[10px] font-semibold leading-none text-slate-600 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-vdidBlue focus-visible:ring-offset-1"
        onClick={(e) => e.preventDefault()}
      >
        i
      </button>
      <span
        role="tooltip"
        className="pointer-events-none invisible absolute left-0 top-full z-20 mt-1 w-72 -translate-x-2 rounded-md border border-slate-200 bg-white p-2 text-xs leading-snug text-slate-700 shadow-md group-hover:visible group-focus-within:visible"
      >
        {text}
      </span>
    </span>
  );
}

function FieldHeader({
  htmlFor,
  label,
  required,
  tip,
}: {
  htmlFor: string;
  label: string;
  required?: boolean;
  tip?: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Label htmlFor={htmlFor}>
        {label}
        {required && <RequiredMark />}
      </Label>
      {tip && <InfoTip text={tip} />}
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
      {over && " — über Empfehlung"}
    </p>
  );
}

export function EventAssetGenerator() {
  const [form, setForm] =
    React.useState<EventFormState>(INITIAL_FORM_STATE);
  const [formHydrated, setFormHydrated] = React.useState(false);
  const [logoLoaded, setLogoLoaded] = React.useState(false);
  /** Set when loading fails so we can show the resolved URL (local vs. deployed). */
  const [logoLoadErrorUrl, setLogoLoadErrorUrl] = React.useState<string | null>(
    null,
  );
  /** Nach Klick auf ZIP/PNG, wenn noch Pflichtfelder fehlen */
  const [exportHint, setExportHint] = React.useState<string | null>(null);
  const logoRef = React.useRef<HTMLImageElement | null>(null);
  const canvasRefs = React.useRef<
    Partial<Record<FormatKey, HTMLCanvasElement | null>>
  >({});

  const backgroundImageRef = React.useRef<HTMLImageElement | null>(null);
  const backgroundObjectUrlRef = React.useRef<string | null>(null);
  const [backgroundLoadState, setBackgroundLoadState] =
    React.useState<BackgroundLoadState>("idle");
  const [previewObjectUrl, setPreviewObjectUrl] = React.useState<string | null>(
    null,
  );
  const [previewNaturalSize, setPreviewNaturalSize] = React.useState<{
    width: number;
    height: number;
  } | null>(null);
  const [focalPoint, setFocalPoint] = React.useState<FocalPoint>({
    x: 0.5,
    y: 0.5,
  });
  const [overlayEnabled, setOverlayEnabled] = React.useState(false);
  const [overlayOpacity, setOverlayOpacity] = React.useState(0.35);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const focalContainerRef = React.useRef<HTMLDivElement | null>(null);
  const [focalMarkerPx, setFocalMarkerPx] = React.useState<{
    left: number;
    top: number;
  } | null>(null);
  const [formatPreviewLightbox, setFormatPreviewLightbox] = React.useState<{
    key: FormatKey;
    dataUrl: string;
  } | null>(null);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(FORM_STORAGE_KEY);
      if (raw) {
        const parsed = parseStoredForm(raw);
        if (parsed) setForm(parsed);
      }
    } catch {
      /* ignore */
    }
    setFormHydrated(true);
  }, []);

  React.useEffect(() => {
    if (!formHydrated || typeof window === "undefined") return;
    try {
      localStorage.setItem(FORM_STORAGE_KEY, serializeForm(form));
    } catch {
      /* quota / private mode */
    }
  }, [form, formHydrated]);

  // Load logo once from /public (URL resolves via publicFile — works with basePath)
  React.useEffect(() => {
    const url = publicFile("/VDID_Logo_neg.svg");
    setLogoLoadErrorUrl(null);
    const img = new Image();
    img.onload = () => {
      logoRef.current = img;
      setLogoLoaded(true);
      setLogoLoadErrorUrl(null);
    };
    img.onerror = () => {
      console.error("Failed to load logo from:", url);
      setLogoLoaded(false);
      setLogoLoadErrorUrl(url);
    };
    img.src = url;
  }, []);

  React.useEffect(() => {
    return () => {
      if (backgroundObjectUrlRef.current) {
        URL.revokeObjectURL(backgroundObjectUrlRef.current);
        backgroundObjectUrlRef.current = null;
      }
    };
  }, []);

  const revokeBackgroundUrl = () => {
    if (backgroundObjectUrlRef.current) {
      URL.revokeObjectURL(backgroundObjectUrlRef.current);
      backgroundObjectUrlRef.current = null;
    }
  };

  const applyBackgroundFile = React.useCallback((file: File | undefined) => {
    if (!file || !file.type.startsWith("image/")) return;

    revokeBackgroundUrl();
    backgroundImageRef.current = null;
    setPreviewNaturalSize(null);
    setFocalPoint({ x: 0.5, y: 0.5 });

    const url = URL.createObjectURL(file);
    backgroundObjectUrlRef.current = url;
    setPreviewObjectUrl(url);
    setBackgroundLoadState("loading");

    const img = new Image();
    img.onload = () => {
      backgroundImageRef.current = img;
      setPreviewNaturalSize({
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
      setBackgroundLoadState("ready");
    };
    img.onerror = () => {
      console.error("Failed to load background image");
      backgroundImageRef.current = null;
      setPreviewNaturalSize(null);
      setPreviewObjectUrl(null);
      revokeBackgroundUrl();
      setBackgroundLoadState("idle");
    };
    img.src = url;
  }, []);

  const handleBackgroundFileChange: React.ChangeEventHandler<
    HTMLInputElement
  > = (e) => {
    applyBackgroundFile(e.target.files?.[0]);
    e.target.value = "";
  };

  const [dropZoneActive, setDropZoneActive] = React.useState(false);

  const handleDropZoneDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget;
    const related = e.relatedTarget as Node | null;
    if (related && target.contains(related)) return;
    setDropZoneActive(true);
  };

  const handleDropZoneDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget;
    const related = e.relatedTarget as Node | null;
    if (related && target.contains(related)) return;
    setDropZoneActive(false);
  };

  const handleDropZoneDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDropZoneDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDropZoneActive(false);
    applyBackgroundFile(e.dataTransfer.files?.[0]);
  };

  const clearBackgroundImage = () => {
    revokeBackgroundUrl();
    backgroundImageRef.current = null;
    setPreviewObjectUrl(null);
    setPreviewNaturalSize(null);
    setBackgroundLoadState("idle");
    setFocalPoint({ x: 0.5, y: 0.5 });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFocalPreviewClick = (
    e: React.MouseEvent<HTMLDivElement>,
  ) => {
    if (!previewObjectUrl || !previewNaturalSize) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const { width: nw, height: nh } = previewNaturalSize;
    const { x, y } = clientPointToFocalNormalized(
      e.clientX,
      e.clientY,
      rect,
      nw,
      nh,
    );
    setFocalPoint({ x, y });
  };

  const openFormatPreviewLightbox = (key: FormatKey) => {
    const canvas = canvasRefs.current[key];
    if (!canvas || canvas.width === 0) return;
    setFormatPreviewLightbox({
      key,
      dataUrl: canvas.toDataURL("image/png"),
    });
  };

  React.useEffect(() => {
    if (!formatPreviewLightbox) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") setFormatPreviewLightbox(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [formatPreviewLightbox]);

  React.useEffect(() => {
    if (!formatPreviewLightbox) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [formatPreviewLightbox]);

  React.useLayoutEffect(() => {
    const el = focalContainerRef.current;
    if (!el || !previewNaturalSize || !previewObjectUrl) {
      setFocalMarkerPx(null);
      return;
    }
    const update = () => {
      const W = el.clientWidth;
      const H = el.clientHeight;
      const nw = previewNaturalSize.width;
      const nh = previewNaturalSize.height;
      const scale = Math.min(W / nw, H / nh);
      const dispW = nw * scale;
      const dispH = nh * scale;
      const offX = (W - dispW) / 2;
      const offY = (H - dispH) / 2;
      setFocalMarkerPx({
        left: offX + focalPoint.x * dispW,
        top: offY + focalPoint.y * dispH,
      });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [focalPoint, previewNaturalSize, previewObjectUrl]);

  const handleChangeText = (
    field:
      | "title"
      | "subtitle"
      | "time"
      | "place"
      | "captionWebsite"
      | "captionInstagram"
      | "captionLinkedIn"
      | "copyright",
  ): React.ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement> => {
    return (e) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
    };
  };

  const handleDateChange = (date: Date | null) => {
    setForm((prev) => ({ ...prev, date }));
  };

  const handleTimeChange = (time: string) => {
    setForm((prev) => ({ ...prev, time }));
  };

  const renderAll = React.useCallback(() => {
    const logo = logoRef.current;
    if (!logo) return;

    const backgroundImage =
      backgroundLoadState === "ready" ? backgroundImageRef.current : null;

    (Object.keys(FORMAT_CONFIG) as FormatKey[]).forEach((key) => {
      const canvas = canvasRefs.current[key];
      if (!canvas) return;
      const cfg = FORMAT_CONFIG[key];
      canvas.width = cfg.width;
      canvas.height = cfg.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      drawFormat(canvas, ctx, cfg, form, logo, {
        backgroundImage,
        focalPoint,
        overlayEnabled,
        overlayOpacity,
      });
    });
  }, [
    form,
    backgroundLoadState,
    focalPoint,
    overlayEnabled,
    overlayOpacity,
  ]);

  React.useEffect(() => {
    if (logoLoaded) {
      renderAll();
    }
  }, [logoLoaded, renderAll]);

  const handleDownload = (key: FormatKey) => {
    const canvas = canvasRefs.current[key];
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = url;
    link.download = `${exportAssetBasename(form.title, FORMAT_EXPORT_SLUG[key], new Date())}.png`;
    link.click();
  };

  const assetsReady =
    logoLoaded && backgroundLoadState !== "loading";

  const zipTextsReady =
    form.title.trim().length > 0 &&
    form.captionWebsite.trim().length > 0 &&
    form.captionInstagram.trim().length > 0 &&
    form.captionLinkedIn.trim().length > 0 &&
    form.copyright.trim().length > 0;

  const zipDownloadReady = assetsReady && zipTextsReady;

  React.useEffect(() => {
    setExportHint(null);
  }, [form, logoLoaded, backgroundLoadState]);

  const collectZipMissing = React.useCallback((): string[] => {
    const missing: string[] = [];
    if (!logoLoaded) missing.push("Logo");
    if (backgroundLoadState === "loading") missing.push("Hintergrund lädt noch");
    if (!form.title.trim()) missing.push("Titel (im Bild)");
    if (!form.copyright.trim()) missing.push("Copyright (Bild)");
    if (!form.captionWebsite.trim()) missing.push("Caption Website");
    if (!form.captionInstagram.trim()) missing.push("Caption Instagram");
    if (!form.captionLinkedIn.trim()) missing.push("Caption LinkedIn");
    return missing;
  }, [
    logoLoaded,
    backgroundLoadState,
    form.title,
    form.copyright,
    form.captionWebsite,
    form.captionInstagram,
    form.captionLinkedIn,
  ]);

  const collectPngMissing = React.useCallback((): string[] => {
    const missing: string[] = [];
    if (!logoLoaded) missing.push("Logo");
    if (backgroundLoadState === "loading") missing.push("Hintergrund lädt noch");
    if (!form.title.trim()) missing.push("Titel (im Bild)");
    if (!form.copyright.trim()) missing.push("Copyright (Bild)");
    return missing;
  }, [logoLoaded, backgroundLoadState, form.title, form.copyright]);

  const handleDownloadAll = async () => {
    const zip = new JSZip();
    const downloadDate = new Date();

    // Ensure all canvases are rendered
    renderAll();

    // Wait a bit for canvases to render
    await new Promise((resolve) => setTimeout(resolve, 100));

    const pngArchiveEntries: {
      formatKey: FormatKey;
      label: string;
      filename: string;
    }[] = [];

    // Add each canvas as a PNG to the zip
    (Object.keys(FORMAT_CONFIG) as FormatKey[]).forEach((key) => {
      const canvas = canvasRefs.current[key];
      if (canvas) {
        const dataUrl = canvas.toDataURL("image/png");
        const base64Data = dataUrl.split(",")[1];
        const name = `${exportAssetBasename(form.title, FORMAT_EXPORT_SLUG[key], downloadDate)}.png`;
        pngArchiveEntries.push({
          formatKey: key,
          label: FORMAT_CONFIG[key].label,
          filename: name,
        });
        zip.file(name, base64Data, { base64: true });
      }
    });

    const captionExports: {
      slug: string;
      text: string;
      channel: "website" | "instagram" | "linkedin";
    }[] = [
      {
        slug: "Caption-Website",
        text: form.captionWebsite.trim(),
        channel: "website",
      },
      {
        slug: "Caption-Instagram",
        text: form.captionInstagram.trim(),
        channel: "instagram",
      },
      {
        slug: "Caption-LinkedIn",
        text: form.captionLinkedIn.trim(),
        channel: "linkedin",
      },
    ];

    const captionTxtArchiveEntries: {
      channel: string;
      slug: string;
      filename: string;
    }[] = [];

    for (const item of captionExports) {
      const txtName = `${exportAssetBasename(form.title, item.slug, downloadDate)}.txt`;
      captionTxtArchiveEntries.push({
        channel: item.channel,
        slug: item.slug,
        filename: txtName,
      });
      zip.file(txtName, item.text);
    }

    const zipBasename = exportAssetBasename(
      form.title,
      "all-formats",
      downloadDate,
    );
    const zipDownloadFilename = `${zipBasename}.zip`;
    const jsonBasename = exportAssetBasename(
      form.title,
      "asset-export",
      downloadDate,
    );
    const jsonFilename = `${jsonBasename}.json`;

    const exportManifest = {
      export: {
        generatedAt: downloadDate.toISOString(),
        zipArchiveFilename: zipDownloadFilename,
        manifestFilename: jsonFilename,
      },
      texts: {
        titleImage: form.title,
        subtitle: form.subtitle,
        copyright: form.copyright,
        eventFormat: form.eventFormat,
        eventFormatCustom: form.eventFormatCustom,
        date: form.date ? form.date.toISOString() : null,
        time: form.time,
        place: form.place,
        isOnline: form.isOnline,
        captions: {
          website: form.captionWebsite,
          instagram: form.captionInstagram,
          linkedin: form.captionLinkedIn,
        },
      },
      filesInArchive: {
        pngImages: pngArchiveEntries.map((e) => ({
          formatKey: e.formatKey,
          label: e.label,
          filename: e.filename,
        })),
        captionTextFiles: captionTxtArchiveEntries.map((e) => ({
          channel: e.channel,
          filename: e.filename,
        })),
      },
    };

    zip.file(
      jsonFilename,
      JSON.stringify(exportManifest, null, 2),
    );

    // Generate and download the zip file
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = zipDownloadFilename;
    link.click();
    URL.revokeObjectURL(url);
    try {
      localStorage.removeItem(FORM_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  };

  const handleResetForm = () => {
    setForm(INITIAL_FORM_STATE);
    clearBackgroundImage();
    setOverlayEnabled(false);
    setOverlayOpacity(0.35);
    setExportHint(null);
    try {
      localStorage.removeItem(FORM_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  };

  const handleZipButtonClick = () => {
    const missing = collectZipMissing();
    if (missing.length > 0) {
      setExportHint(`Es fehlen noch: ${missing.join(", ")}.`);
      return;
    }
    setExportHint(null);
    void handleDownloadAll();
  };

  const handlePngButtonClick = (key: FormatKey) => {
    const missing = collectPngMissing();
    if (missing.length > 0) {
      setExportHint(`Für PNG-Download fehlt: ${missing.join(", ")}.`);
      return;
    }
    setExportHint(null);
    handleDownload(key);
  };

  return (
    <>
      <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Event &amp; Grafik</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left Column */}
            <div className="space-y-4">
              <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3">
                <div className="space-y-1">
                  <Label htmlFor="title">
                    Titel (im Bild)
                    <RequiredMark />
                  </Label>
                  <Textarea
                    id="title"
                    value={form.title}
                    onChange={handleChangeText("title")}
                    placeholder="erscheint als Hauptzeile auf allen Formaten"
                    rows={2}
                    className="resize-none bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="copyright">
                    Copyright (Bild)
                    <RequiredMark />
                  </Label>
                  <Textarea
                    id="copyright"
                    value={form.copyright}
                    onChange={handleChangeText("copyright")}
                    placeholder="z. B. © Name · Foto: …"
                    rows={2}
                    className="resize-none bg-white"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="subtitle">Unterzeile</Label>
                <Textarea
                  id="subtitle"
                  value={form.subtitle}
                  onChange={handleChangeText("subtitle")}
                  placeholder="Kurze Beschreibung oder Claim"
                  rows={2}
                  className="resize-none"
                />
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="eventFormat">Eventformat</Label>
                <select
                  id="eventFormat"
                  value={form.eventFormat}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, eventFormat: e.target.value }));
                  }}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-slate-900 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="–">–</option>
                  <option value="VDID Design.Wissen.Diskurs.">
                    VDID Design.Wissen.Diskurs.
                  </option>
                  <option value="VDID Insight Update">VDID Insight Update</option>
                  <option value="other">other</option>
                </select>
                {form.eventFormat === "other" && (
                  <Input
                    value={form.eventFormatCustom}
                    onChange={(e) => {
                      setForm((prev) => ({
                        ...prev,
                        eventFormatCustom: e.target.value,
                      }));
                    }}
                    placeholder="Eigenes Eventformat eingeben"
                    className="mt-2"
                  />
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Datum</Label>
                  <DatePicker date={form.date} onChange={handleDateChange} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="time">Uhrzeit</Label>
                  <TimePicker value={form.time} onChange={handleTimeChange} />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="place">Ort</Label>
                <Input
                  id="place"
                  value={form.place}
                  onChange={handleChangeText("place")}
                  placeholder="Veranstaltungsort"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isOnline"
                  checked={form.isOnline}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, isOnline: e.target.checked }));
                  }}
                />
                <Label htmlFor="isOnline" className="cursor-pointer">
                  Online-Veranstaltung
                </Label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Hintergrund</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            id="background-image"
            tabIndex={-1}
            onChange={handleBackgroundFileChange}
          />
          <div
            className={cn(
              "relative flex min-h-[140px] flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors",
              previewObjectUrl ? "min-h-[88px] py-5" : "py-10",
              dropZoneActive
                ? "border-vdidBlue bg-blue-50 ring-2 ring-vdidBlue/25"
                : "border-slate-300 bg-slate-50 hover:border-slate-400",
            )}
            onDragEnter={handleDropZoneDragEnter}
            onDragLeave={handleDropZoneDragLeave}
            onDragOver={handleDropZoneDragOver}
            onDrop={handleDropZoneDrop}
          >
            <p className="text-sm text-slate-700">
              <label
                htmlFor="background-image"
                className="cursor-pointer font-medium text-vdidBlue underline-offset-4 hover:underline"
              >
                Datei wählen
              </label>
              <span className="text-slate-600">
                {" "}
                oder Bild hierher ziehen
              </span>
            </p>
            <p className="max-w-md text-xs text-slate-500">
              Optional: Hintergrund für alle Formate. PNG, JPG, WebP … — sehr
              große Dateien können den Browser verlangsamen.
            </p>
            {previewObjectUrl && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-1"
                onClick={(e) => {
                  e.stopPropagation();
                  clearBackgroundImage();
                }}
              >
                Bild entfernen
              </Button>
            )}
          </div>

          {previewObjectUrl && previewNaturalSize && (
            <div className="space-y-2">
              <Label>Blickpunkt (Klick auf die Vorschau)</Label>
              <div
                ref={focalContainerRef}
                role="button"
                tabIndex={0}
                className="relative mx-auto w-full max-w-xl cursor-crosshair rounded-md border border-slate-200 bg-slate-100"
                style={{ minHeight: 120, maxHeight: 192 }}
                onClick={handleFocalPreviewClick}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter" || ev.key === " ") {
                    ev.preventDefault();
                  }
                }}
              >
                <img
                  src={previewObjectUrl}
                  alt=""
                  className="mx-auto block max-h-48 w-auto max-w-full object-contain"
                  draggable={false}
                />
                {focalMarkerPx && (
                  <span
                    className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-vdidBlue shadow-md ring-2 ring-white/80"
                    style={{
                      left: focalMarkerPx.left,
                      top: focalMarkerPx.top,
                    }}
                    aria-hidden
                  />
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                <span>
                  Blickpunkt: {Math.round(focalPoint.x * 100)}% ×{" "}
                  {Math.round(focalPoint.y * 100)}%
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setFocalPoint({ x: 0.5, y: 0.5 })}
                >
                  Mitte
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-2 border-t border-slate-200 pt-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id="overlayEnabled"
                checked={overlayEnabled}
                onChange={(e) => setOverlayEnabled(e.target.checked)}
              />
              <Label htmlFor="overlayEnabled" className="cursor-pointer">
                Abdunkeln für bessere Lesbarkeit
              </Label>
            </div>
            {overlayEnabled && (
              <div className="flex max-w-md flex-col gap-1">
                <Label htmlFor="overlayOpacity" className="text-xs">
                  Stärke ({Math.round(overlayOpacity * 100)}%)
                </Label>
                <input
                  id="overlayOpacity"
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(overlayOpacity * 100)}
                  onChange={(e) =>
                    setOverlayOpacity(Number(e.target.value) / 100)
                  }
                  className="w-full accent-vdidBlue"
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-col items-stretch gap-1">
          <CardTitle>Captions</CardTitle>
          <p className="text-sm font-normal leading-snug text-slate-600">
            Begleittexte für die Kanäle — nicht auf der Grafik, nur für
            Veröffentlichung und ZIP (.txt).
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <FieldHeader
                htmlFor="captionWebsite"
                label="Caption Website"
                required
                tip="Vollständiger Begleittext für Web / CMS (z. B. Teaser / Lede). Hook in die ersten ~155–160 Zeichen, damit der Suchergebnis-Snippet nicht abgeschnitten wird. Richtwert insgesamt ~500 Zeichen."
              />
              <Textarea
                id="captionWebsite"
                value={form.captionWebsite}
                onChange={handleChangeText("captionWebsite")}
                placeholder="Begleittext für Web / CMS"
                rows={5}
                className="resize-y min-h-[100px]"
              />
              <CharCount value={form.captionWebsite} softLimit={500} />
            </div>
            <div className="space-y-1">
              <FieldHeader
                htmlFor="captionInstagram"
                label="Caption Instagram"
                required
                tip="Hook in die ersten ~125 Zeichen, da Instagram danach „mehr…“ einblendet — anschließend folgt der eigentliche Content. Hashtags ans Ende. Plattform-Limit insgesamt 2.200 Zeichen."
              />
              <Textarea
                id="captionInstagram"
                value={form.captionInstagram}
                onChange={handleChangeText("captionInstagram")}
                placeholder="Post-Text / Bildunterschrift"
                rows={5}
                className="resize-y min-h-[100px]"
              />
              <CharCount value={form.captionInstagram} softLimit={2200} />
            </div>
            <div className="space-y-1">
              <FieldHeader
                htmlFor="captionLinkedIn"
                label="Caption LinkedIn"
                required
                tip="Hook in die ersten ~210 Zeichen (vor „…mehr anzeigen“), danach folgt der eigentliche Beitragstext. Max. 3 relevante Hashtags. Plattform-Limit insgesamt 3.000 Zeichen."
              />
              <Textarea
                id="captionLinkedIn"
                value={form.captionLinkedIn}
                onChange={handleChangeText("captionLinkedIn")}
                placeholder="Beitragstext für LinkedIn"
                rows={5}
                className="resize-y min-h-[100px]"
              />
              <CharCount value={form.captionLinkedIn} softLimit={3000} />
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Pflicht für den ZIP-Download; die drei Texte werden zusätzlich als
            separate .txt-Dateien ins Archiv gelegt.
          </p>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <p className="text-xs text-slate-500">
          Vorschau anklicken für große Ansicht (volle Exportauflösung).
        </p>
        <div className="grid gap-4 lg:grid-cols-2">
        {(Object.keys(FORMAT_CONFIG) as FormatKey[]).map((key) => {
          const cfg = FORMAT_CONFIG[key];
          const pngReady =
            assetsReady &&
            form.title.trim().length > 0 &&
            form.copyright.trim().length > 0;
          return (
            <Card key={key}>
              <CardHeader>
                <CardTitle>{cfg.label}</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => handlePngButtonClick(key)}
                  aria-disabled={!pngReady}
                  className={cn(
                    !pngReady &&
                      "opacity-50 saturate-50 cursor-pointer hover:opacity-60",
                  )}
                >
                  PNG herunterladen
                </Button>
              </CardHeader>
              <CardContent>
                <div className="w-full border border-slate-200 rounded-md bg-slate-50 p-2 overflow-auto">
                  <div className="flex justify-center">
                    <button
                      type="button"
                      className="group relative cursor-zoom-in rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vdidBlue focus-visible:ring-offset-2"
                      onClick={() => openFormatPreviewLightbox(key)}
                      disabled={!logoLoaded}
                      aria-label={`${cfg.label} in groß anzeigen`}
                    >
                      <canvas
                        ref={(el) => {
                          canvasRefs.current[key] = el;
                        }}
                        className="block bg-vdidBlue transition-opacity group-hover:opacity-95 group-disabled:cursor-not-allowed group-disabled:opacity-60"
                        style={{
                          maxWidth: "100%",
                          height: "auto",
                          maxHeight: 400,
                          aspectRatio: `${cfg.width} / ${cfg.height}`,
                        }}
                      />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        </div>

        <div className="border-t border-slate-200 pt-6">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              onClick={handleZipButtonClick}
              aria-disabled={!zipDownloadReady}
              className={cn(
                !zipDownloadReady &&
                  "opacity-50 saturate-50 cursor-pointer hover:opacity-60",
              )}
            >
              Alle Assets als ZIP herunterladen
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleResetForm}
            >
              Zurücksetzen
            </Button>
          </div>
          {exportHint && (
            <p className="mt-2 text-sm text-red-700" role="status">
              {exportHint}
            </p>
          )}
          {!logoLoaded && !logoLoadErrorUrl && (
            <p className="mt-2 text-xs text-slate-500">Logo wird geladen…</p>
          )}
          {logoLoadErrorUrl && (
            <p className="mt-2 text-xs text-red-700">
              Logo konnte nicht geladen werden:{" "}
              <code className="break-all">{logoLoadErrorUrl}</code>. Im Repo muss{" "}
              <code>public/VDID_Logo_neg.svg</code> existieren; nach dem Export liegt
              die Datei neben der index.html (relativer Pfad{" "}
              <code>./VDID_Logo_neg.svg</code>).
            </p>
          )}
        </div>
      </div>
    </div>

      {typeof document !== "undefined" &&
        formatPreviewLightbox &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-6"
            role="dialog"
            aria-modal="true"
            aria-label={
              FORMAT_CONFIG[formatPreviewLightbox.key].label + " Vorschau"
            }
            onClick={() => setFormatPreviewLightbox(null)}
          >
            <button
              type="button"
              className="absolute right-4 top-4 rounded-full bg-white/15 px-3 py-1.5 text-sm font-medium text-white backdrop-blur transition-colors hover:bg-white/25"
              aria-label="Schließen"
              onClick={(e) => {
                e.stopPropagation();
                setFormatPreviewLightbox(null);
              }}
            >
              Schließen
            </button>
            <img
              src={formatPreviewLightbox.dataUrl}
              alt={`${FORMAT_CONFIG[formatPreviewLightbox.key].label}, große Ansicht`}
              className="max-h-[min(90vh,100%)] max-w-[min(90vw,100%)] select-none object-contain shadow-2xl"
              onClick={(e) => e.stopPropagation()}
              draggable={false}
            />
          </div>,
          document.body,
        )}
    </>
  );
}

type BackgroundDrawOptions = {
  backgroundImage: HTMLImageElement | null;
  focalPoint: FocalPoint;
  overlayEnabled: boolean;
  overlayOpacity: number;
};

function clientPointToFocalNormalized(
  clientX: number,
  clientY: number,
  containerRect: DOMRect,
  naturalW: number,
  naturalH: number,
): FocalPoint {
  const cw = containerRect.width;
  const ch = containerRect.height;
  const px = clientX - containerRect.left;
  const py = clientY - containerRect.top;
  const scale = Math.min(cw / naturalW, ch / naturalH);
  const dispW = naturalW * scale;
  const dispH = naturalH * scale;
  const offX = (cw - dispW) / 2;
  const offY = (ch - dispH) / 2;
  const nx = (px - offX) / dispW;
  const ny = (py - offY) / dispH;
  return {
    x: Math.min(1, Math.max(0, nx)),
    y: Math.min(1, Math.max(0, ny)),
  };
}

function drawBackgroundCover(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  img: HTMLImageElement,
  focalX: number,
  focalY: number,
) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (iw <= 0 || ih <= 0) return;

  const scale = Math.max(width / iw, height / ih);
  const drawW = iw * scale;
  const drawH = ih * scale;
  // Pan so focal sits near center, but clamp so the scaled bitmap always covers
  // the full canvas (no letterboxing gaps when focal is near an edge).
  const dxIdeal = width / 2 - focalX * drawW;
  const dyIdeal = height / 2 - focalY * drawH;
  const dx = Math.min(0, Math.max(width - drawW, dxIdeal));
  const dy = Math.min(0, Math.max(height - drawH, dyIdeal));

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, width, height);
  ctx.clip();
  ctx.drawImage(img, dx, dy, drawW, drawH);
  ctx.restore();
}

function drawFormat(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  cfg: { width: number; height: number; includeMeta: boolean },
  form: EventFormState,
  logo: HTMLImageElement,
  background: BackgroundDrawOptions,
) {
  const { width, height } = cfg;
  const { backgroundImage, focalPoint, overlayEnabled, overlayOpacity } =
    background;

  // Background: photo with focal cover, or solid VDID blue
  if (backgroundImage && backgroundImage.complete) {
    drawBackgroundCover(
      ctx,
      width,
      height,
      backgroundImage,
      focalPoint.x,
      focalPoint.y,
    );
  } else {
    ctx.fillStyle = "#0A2CD9";
    ctx.fillRect(0, 0, width, height);
  }

  if (overlayEnabled && overlayOpacity > 0) {
    ctx.fillStyle = `rgba(0,0,0,${overlayOpacity})`;
    ctx.fillRect(0, 0, width, height);
  }

  // Safe margins
  const marginX = width * 0.08;
  const marginY = height * 0.12;

  // Draw logo (top left)
  const logoHeight = Math.min(height * 0.16, 160);
  const logoAspect = logo.width / logo.height || 1;
  const logoWidth = logoHeight * logoAspect;
  ctx.drawImage(logo, marginX, marginY, logoWidth, logoHeight);

  // Typography - positioned in lower third
  const titleMaxWidth = width - marginX * 2;
  
  // Calculate font size first
  const baseTitleSize = Math.min(width, height) * 0.07;
  const titleFontSize = Math.max(32, baseTitleSize);
  
  // Set up context for text measurement
  ctx.fillStyle = "#FFFFFF";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.font = `500 ${titleFontSize}px Roboto, system-ui, sans-serif`;
  
  // Calculate all text dimensions first
  const metaFontSize = titleFontSize * 0.45;
  const subtitleFontSize = titleFontSize * 0.55;
  const lineHeightTitle = titleFontSize * 1.2;
  const lineHeightSubtitle = subtitleFontSize * 1.3;
  
  // Get event format text (styled like date/time)
  const eventFormatText =
    form.eventFormat === "other"
      ? form.eventFormatCustom
      : form.eventFormat !== "–"
        ? form.eventFormat
        : "";
  
  // Measure all text to calculate total height
  ctx.font = `400 ${metaFontSize}px Roboto, system-ui, sans-serif`;
  const eventFormatLines = eventFormatText
    ? wrapText(ctx, eventFormatText, titleMaxWidth)
    : [];
  
  ctx.font = `500 ${titleFontSize}px Roboto, system-ui, sans-serif`;
  const titleLines = form.title.trim()
    ? wrapText(ctx, form.title, titleMaxWidth)
    : [];
  ctx.font = `400 ${subtitleFontSize}px Roboto, system-ui, sans-serif`;
  const subtitleLines = form.subtitle ? wrapText(ctx, form.subtitle, titleMaxWidth) : [];
  
  // Calculate spacing constants
  const spacingAfterEventFormat = metaFontSize * 0.8; // spacing between event format and title
  const spacingAfterTitle = subtitleFontSize * 0.8; // spacing between title and subtitle
  const spacingAfterSubtitle = metaFontSize * 1.0; // spacing between subtitle and date/time
  
  // Calculate actual heights
  const eventFormatHeight = eventFormatLines.length * metaFontSize * 1.2;
  const titleHeight = titleLines.length * lineHeightTitle;
  const subtitleHeight = subtitleLines.length * lineHeightSubtitle;
  const metaHeight = metaFontSize * 1.4;
  
  // Calculate total height needed for all content
  // For website formats, only count what will actually be rendered (event format + title)
  let totalTextHeight = 0;
  if (eventFormatText && eventFormatLines.length > 0) {
    totalTextHeight += eventFormatHeight + spacingAfterEventFormat;
  }
  totalTextHeight += titleHeight;
  
  // Calculate meta parts for date/time/place
  const dateText = form.date ? format(form.date, "dd.MM.yyyy") : "";
  const metaParts = [dateText, form.time].filter(Boolean);
  
  // Add place or "Online" based on checkbox
  if (form.isOnline) {
    metaParts.push("Online");
  } else if (form.place) {
    metaParts.push(form.place);
  }
  
  // Only add subtitle and date/time for formats that include meta
  if (cfg.includeMeta) {
    if (form.subtitle && subtitleLines.length > 0) {
      totalTextHeight +=
        (titleLines.length > 0 ? spacingAfterTitle : 0) + subtitleHeight;
    }
    if (metaParts.length > 0) {
      totalTextHeight += spacingAfterSubtitle + metaHeight;
    }
  }
  
  // Position text group in lower third, ensuring no overlap
  // Minimum safe distance from logo
  const logoBottom = marginY + logoHeight;
  const minDistanceFromLogo = height * 0.05; // 5% of canvas height minimum
  const minTextStartY = logoBottom + minDistanceFromLogo;
  
  // Target position: lower third (67% of height)
  const lowerThirdStart = height * 0.67;
  
  // For formats with meta: position from bottom, but respect constraints
  let textStartY: number;
  if (cfg.includeMeta) {
    // Calculate position from bottom
    const bottomPosition = height - marginY - totalTextHeight;
    // Use the higher of: bottom-calculated position, lower third start, or minimum from logo
    textStartY = Math.max(bottomPosition, lowerThirdStart, minTextStartY);
  } else {
    // For website formats: fixed position in lower third, regardless of date/time input
    textStartY = Math.max(lowerThirdStart, minTextStartY);
  }
  
  // Ensure text doesn't overflow bottom (only check for formats with meta)
  if (cfg.includeMeta) {
    const maxTextEndY = height - marginY;
    if (textStartY + totalTextHeight > maxTextEndY) {
      // If content is too tall, position from bottom with margin
      textStartY = maxTextEndY - totalTextHeight;
      // But still respect minimum from logo
      textStartY = Math.max(textStartY, minTextStartY);
    }
  }

  // Draw Event Format (above title, styled like date/time)
  let y = textStartY;
  if (eventFormatText && eventFormatLines.length > 0) {
    ctx.font = `400 ${metaFontSize}px Roboto, system-ui, sans-serif`;
    for (const line of eventFormatLines) {
      ctx.fillText(line, marginX, y);
      y += metaFontSize * 1.2;
    }
    y += spacingAfterEventFormat;
  }

  // Draw Title
  ctx.font = `500 ${titleFontSize}px Roboto, system-ui, sans-serif`;
  for (const line of titleLines) {
    ctx.fillText(line, marginX, y);
    y += lineHeightTitle;
  }

  if (cfg.includeMeta) {
    // Draw Subtitle
    if (form.subtitle && subtitleLines.length > 0) {
      if (titleLines.length > 0) {
        y += spacingAfterTitle;
      }
      ctx.font = `400 ${subtitleFontSize}px Roboto, system-ui, sans-serif`;
      for (const line of subtitleLines) {
        ctx.fillText(line, marginX, y);
        y += lineHeightSubtitle;
      }
    }

    // Draw Date & time line
    if (metaParts.length > 0) {
      y += spacingAfterSubtitle;
      const metaText = metaParts.join(" • ");
      ctx.font = `400 ${metaFontSize}px Roboto, system-ui, sans-serif`;
      ctx.fillText(metaText, marginX, y);
    }
  }

  drawCopyrightOnCanvas(ctx, width, height, form.copyright, marginX, marginY);
}

/** Einheitliches © vor dem Rest; vorhandenes © am Anfang nicht verdoppeln. */
function copyrightDisplayText(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (/^©[\s\u00A0]*/u.test(t)) return t;
  return `© ${t}`;
}

/** Vertikal am rechten Rand, unten ausgerichtet (nach oben entlang), halbtransparent. */
function drawCopyrightOnCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  text: string,
  marginX: number,
  marginY: number,
) {
  const trimmed = text.trim();
  if (!trimmed) return;

  const display = copyrightDisplayText(trimmed);
  const marginRight = Math.max(10, marginX * 0.45);
  const marginBottom = Math.max(12, marginY * 0.4);
  const maxSpan = Math.max(40, height - marginY * 2);

  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  let fontSize = Math.max(10, Math.min(width, height) * 0.017);
  const minSize = 8;
  while (fontSize >= minSize) {
    ctx.font = `400 ${fontSize}px Roboto, system-ui, sans-serif`;
    if (ctx.measureText(display).width <= maxSpan) break;
    fontSize -= 0.5;
  }
  ctx.font = `400 ${fontSize}px Roboto, system-ui, sans-serif`;

  // Nach -90° entspricht die Textbreite der Höhe entlang der Kante; unten ausrichten
  const verticalExtent = ctx.measureText(display).width;
  const cx = width - marginRight;
  const cy = height - marginBottom - verticalExtent / 2;

  ctx.translate(cx, cy);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(display, 0, 0);
  ctx.restore();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  // First, split on explicit line breaks (\n)
  const explicitLines = text.split(/\n/);
  const allLines: string[] = [];

  // For each explicit line, wrap it if needed
  for (const explicitLine of explicitLines) {
    const words = explicitLine.split(/\s+/);
    let current = "";

    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      const width = ctx.measureText(test).width;
      if (width > maxWidth && current) {
        allLines.push(current);
        current = word;
      } else {
        current = test;
      }
    }

    if (current) {
      allLines.push(current);
    }
  }

  return allLines;
}


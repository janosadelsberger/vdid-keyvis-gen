"use client";

import React from "react";
import { createPortal } from "react-dom";
import JSZip from "jszip";
import { jsPDF } from "jspdf";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { loadRecoloredLogo } from "@/lib/lab-logo";
import { exportAssetBasename } from "@/lib/export-naming";
import {
  addCaptionsToZip,
  buildAllCaptionTipsLlmPrompt,
  collectCaptionZipMissing,
  EMPTY_CAPTIONS,
  LAB_CAPTION_PLATFORMS,
  type CaptionSet,
} from "@/lib/captions";
import { formatLabDeckForLlmPrompt } from "@/lib/lab-caption-prompt";
import { CaptionFieldsCard } from "@/components/caption-fields-card";
import { LabFormatPicker } from "@/components/vdidlab/lab-format-picker";
import { cn } from "@/lib/utils";
import { ImageDropZone } from "@/components/image-drop-zone";
import { ImageEditModal } from "@/components/image-edit-modal";
import {
  DEFAULT_IMAGE_EDIT_SETTINGS,
} from "@/lib/image-edit";
import {
  renderLabSlideToContext,
  type LabSlide,
  type SlideType,
  type RenderAssets,
} from "@/lib/lab-slide-render";
import {
  MARKDOWN_FORMAT_HINT,
  stripMarkdown,
} from "@/lib/canvas-richtext";
import { LabDateLineFields } from "@/components/vdidlab/lab-date-line-fields";
import { LabSlidePreviewStrip } from "@/components/vdidlab/lab-slide-preview-strip";
import { PostSlideOrderBar } from "@/components/vdidlab/post-slide-order-bar";
import {
  SlideTemplatePicker,
} from "@/components/vdidlab/slide-template-picker";

export type { LabSlide, SlideType };
export type { LabFormatKey } from "@/lib/lab-formats";

import {
  LAB_FORMAT_KEYS,
  type LabFormatKey,
} from "@/lib/lab-formats";

type FormatConfig = {
  label: string;
  width: number;
  height: number;
  exportSlug: string;
  zipFolder: string;
  topUiSafeInsetRatio?: number;
};

const FORMAT_CONFIG: Record<LabFormatKey, FormatConfig> = {
  instagramPost: {
    label: "Instagram Post 1080×1350",
    width: 1080,
    height: 1350,
    exportSlug: "Instagram-Post-1080x1350",
    zipFolder: "instagram-post",
  },
  instagramStory: {
    label: "Instagram Story 1080×1920",
    width: 1080,
    height: 1920,
    exportSlug: "Instagram-Story-1080x1920",
    zipFolder: "instagram-story",
    topUiSafeInsetRatio: 0.13,
  },
  linkedin: {
    label: "LinkedIn Post 1080×1080",
    width: 1080,
    height: 1080,
    exportSlug: "LinkedIn-1080x1080",
    zipFolder: "linkedin",
  },
  pdf: {
    label: "PDF Slide 1080×1080",
    width: 1080,
    height: 1080,
    exportSlug: "PDF-Slide-1080x1080",
    zipFolder: "pdf-slides",
  },
};

const ALL_LAB_FORMAT_KEYS = LAB_FORMAT_KEYS;

function allLabFormatsEnabled(): Record<LabFormatKey, boolean> {
  return Object.fromEntries(
    ALL_LAB_FORMAT_KEYS.map((k) => [k, true]),
  ) as Record<LabFormatKey, boolean>;
}

const DECK_STORAGE_KEY = "vdid-lab-deck-v1";

const FORMAT_LINE_OPTIONS = [
  "VDID Fortbildung",
  "VDID Design.Wissen.Diskurs.",
  "14. VDID Designer's Breakfast",
] as const;

function formatLineSelectOptions(current: string | undefined): string[] {
  const value = current?.trim() ?? "";
  if (value && !FORMAT_LINE_OPTIONS.includes(value as (typeof FORMAT_LINE_OPTIONS)[number])) {
    return [value, ...FORMAT_LINE_OPTIONS];
  }
  return [...FORMAT_LINE_OPTIONS];
}

function createSlide(type: SlideType): LabSlide {
  const defaults: Partial<Record<SlideType, Partial<LabSlide>>> = {
    title: {
      formatLabel: "VDID Fortbildung",
      heading: "Lebenszyklus-analyse für Designer",
      dateLine: "20.05.2026 | 9:00–13:00",
    },
    quote: {
      heading: "Der Workshop ist",
      body: "„der perfekte Einstieg in die Thematik **KI-Sketching**, das lokal genutzt werden kann. Klare Empfehlung!“",
      name: "Arthur Homa",
      role: "Produkt- und Industriedesigner",
    },
    cta: {
      heading: "Jetzt anmelden!",
      body: "Im Mai-Workshop als Einsteiger:in durchstarten und im Juni in der Fortgeschrittenen-Fortbildung fit werden!",
      contact: "Anmeldungen an **mail@vdid.de**",
    },
    eventPhoto: {
      formatLabel: "VDID Design.Wissen.Diskurs.",
      heading: "Sustainable Products",
      dateLine: "05.05.2026 | 18–20 Uhr",
      name: "mit Sari Dahle und Theo Röder",
    },
    coBranded: {
      formatLabel: "14. VDID Designer's Breakfast",
      heading: "Designing the loop",
      dateLine: "09.05.2026 | 10:00–14:00",
    },
    freeform: {
      heading: "CuRe",
      body: "kreislauffähige Unterarmgehstütze",
      name: "Sari Dahle",
    },
  };

  return {
    id: crypto.randomUUID(),
    type,
    formatLabel: "",
    heading: "",
    body: "",
    dateLine: "",
    name: "",
    role: "",
    contact: "",
    imageUrl: null,
    partnerLogoUrl: null,
    ...defaults[type],
  };
}

type StoredDeck = {
  slides: LabSlide[];
  captions?: CaptionSet;
};

function serializeDeck(slides: LabSlide[], captions: CaptionSet): string {
  const slidesForStorage = slides.map((s) => ({
    ...s,
    imageUrl: s.imageUrl?.startsWith("blob:") ? null : s.imageUrl,
    partnerLogoUrl: s.partnerLogoUrl?.startsWith("blob:")
      ? null
      : s.partnerLogoUrl,
  }));
  return JSON.stringify({ slides: slidesForStorage, captions } satisfies StoredDeck);
}

function parseStoredDeck(raw: string): StoredDeck | null {
  try {
    const o = JSON.parse(raw) as Partial<StoredDeck>;
    if (!Array.isArray(o.slides)) return null;
    const slides = o.slides
      .filter((s): s is LabSlide => typeof s === "object" && s !== null && typeof s.id === "string")
      .map((s) => ({
        id: s.id,
        type: (s.type as SlideType) ?? "freeform",
        formatLabel: s.formatLabel ?? "",
        heading: s.heading ?? "",
        body: s.body ?? "",
        dateLine: s.dateLine ?? "",
        name: s.name ?? "",
        role: s.role ?? "",
        contact: s.contact ?? "",
        imageUrl: s.imageUrl ?? null,
        partnerLogoUrl: s.partnerLogoUrl ?? null,
        imageEdits: s.imageEdits,
      }));
    const legacyDeckTitle =
      typeof (o as { deckTitle?: unknown }).deckTitle === "string"
        ? (o as { deckTitle: string }).deckTitle.trim()
        : "";
    const normalizedSlides =
      slides.length > 0 ? slides : [createSlide("eventPhoto")];
    if (legacyDeckTitle && !normalizedSlides[0]?.heading?.trim()) {
      normalizedSlides[0] = {
        ...normalizedSlides[0],
        heading: legacyDeckTitle,
      };
    }
    const rawCaptions = (o as { captions?: Partial<CaptionSet> }).captions;
    const captions: CaptionSet = {
      captionWebsite:
        typeof rawCaptions?.captionWebsite === "string"
          ? rawCaptions.captionWebsite
          : EMPTY_CAPTIONS.captionWebsite,
      captionInstagram:
        typeof rawCaptions?.captionInstagram === "string"
          ? rawCaptions.captionInstagram
          : EMPTY_CAPTIONS.captionInstagram,
      captionLinkedIn:
        typeof rawCaptions?.captionLinkedIn === "string"
          ? rawCaptions.captionLinkedIn
          : EMPTY_CAPTIONS.captionLinkedIn,
    };
    return { slides: normalizedSlides, captions };
  } catch {
    return null;
  }
}

export function renderLabSlide(
  canvas: HTMLCanvasElement,
  slide: LabSlide,
  formatKey: LabFormatKey,
  assets: RenderAssets,
): void {
  const cfg = FORMAT_CONFIG[formatKey];
  canvas.width = cfg.width;
  canvas.height = cfg.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  renderLabSlideToContext(
    ctx,
    slide,
    {
      width: cfg.width,
      height: cfg.height,
      topUiSafeInsetRatio: cfg.topUiSafeInsetRatio,
    },
    assets,
  );
}

async function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
  return img;
}

function deckExportTitle(slides: LabSlide[]): string {
  const firstHeading = slides.find((s) => s.heading?.trim())?.heading?.trim();
  if (firstHeading) return stripMarkdown(firstHeading);
  return "vdid-lab-deck";
}

function applySlideTypeChange(slide: LabSlide, newType: SlideType): LabSlide {
  if (slide.type === newType) return slide;

  const defaults = createSlide(newType);
  const supportsImage =
    newType === "eventPhoto" ||
    newType === "coBranded" ||
    newType === "freeform";
  const supportsPartner = newType === "coBranded";

  if (!supportsImage && slide.imageUrl) {
    revokeBlobUrl(slide.imageUrl);
  }
  if (!supportsPartner && slide.partnerLogoUrl) {
    revokeBlobUrl(slide.partnerLogoUrl);
  }

  const pick = (current: string | undefined, fallback: string | undefined) =>
    current?.trim() ? current : (fallback ?? "");

  return {
    ...defaults,
    id: slide.id,
    type: newType,
    formatLabel: pick(slide.formatLabel, defaults.formatLabel),
    heading: pick(slide.heading, defaults.heading),
    body: pick(slide.body, defaults.body),
    dateLine: pick(slide.dateLine, defaults.dateLine),
    name: pick(slide.name, defaults.name),
    role: pick(slide.role, defaults.role),
    contact: pick(slide.contact, defaults.contact),
    imageUrl: supportsImage ? slide.imageUrl ?? null : null,
    partnerLogoUrl: supportsPartner ? slide.partnerLogoUrl ?? null : null,
    imageEdits: supportsImage ? slide.imageEdits : undefined,
  };
}

function revokeBlobUrl(url: string | null | undefined) {
  if (url?.startsWith("blob:")) {
    URL.revokeObjectURL(url);
  }
}

function SlideImageUploadField({
  id,
  label,
  hint,
  imageUrl,
  onUpload,
  onClear,
  onEdit,
}: {
  id: string;
  label: string;
  hint?: string;
  imageUrl: string | null | undefined;
  onUpload: (file: File) => void;
  onClear: () => void;
  onEdit?: () => void;
}) {
  return (
    <div className="space-y-2 md:col-span-2">
      <Label htmlFor={id}>{label}</Label>
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
      <ImageDropZone
        id={id}
        previewUrl={imageUrl}
        onFile={onUpload}
        onClear={onClear}
        compact
        hint={
          !imageUrl ? "PNG, JPG, WebP … — erscheint in der Vorschau und im Export." : undefined
        }
      />
      {imageUrl && onEdit && (
        <Button type="button" variant="outline" size="sm" onClick={onEdit}>
          Bild bearbeiten…
        </Button>
      )}
    </div>
  );
}

export function VdidLabGenerator() {
  const [slides, setSlides] = React.useState<LabSlide[]>([
    createSlide("eventPhoto"),
  ]);
  const [captions, setCaptions] = React.useState<CaptionSet>(EMPTY_CAPTIONS);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [previewFormat, setPreviewFormat] =
    React.useState<LabFormatKey>("instagramPost");
  const [deckHydrated, setDeckHydrated] = React.useState(false);
  const [logoLoaded, setLogoLoaded] = React.useState(false);
  const [logoError, setLogoError] = React.useState<string | null>(null);
  const logoRef = React.useRef<HTMLImageElement | null>(null);
  const slideImagesRef = React.useRef<Map<string, HTMLImageElement>>(new Map());
  const partnerLogosRef = React.useRef<Map<string, HTMLImageElement>>(new Map());
  const slidesRef = React.useRef(slides);
  slidesRef.current = slides;
  const [lightboxUrl, setLightboxUrl] = React.useState<string | null>(null);
  const [exportHint, setExportHint] = React.useState<string | null>(null);
  const [exportFormatsEnabled, setExportFormatsEnabled] = React.useState<
    Record<LabFormatKey, boolean>
  >(allLabFormatsEnabled);
  const [photoEditModalOpen, setPhotoEditModalOpen] = React.useState(false);
  const [photoNaturalSize, setPhotoNaturalSize] = React.useState<{
    width: number;
    height: number;
  } | null>(null);
  const [previewRevision, setPreviewRevision] = React.useState(0);

  const bumpPreview = React.useCallback(() => {
    setPreviewRevision((revision) => revision + 1);
  }, []);

  const enabledExportFormats = React.useMemo(
    () => ALL_LAB_FORMAT_KEYS.filter((key) => exportFormatsEnabled[key]),
    [exportFormatsEnabled],
  );

  const previewFormatOptions = React.useMemo(
    () =>
      ALL_LAB_FORMAT_KEYS.filter(
        (key) => exportFormatsEnabled[key] && key !== "pdf",
      ),
    [exportFormatsEnabled],
  );

  const enabledPngFormats = React.useMemo(
    () => enabledExportFormats.filter((key) => key !== "pdf"),
    [enabledExportFormats],
  );

  const toggleExportFormat = (key: LabFormatKey, checked: boolean) => {
    setExportFormatsEnabled((prev) => {
      if (!checked) {
        const enabledCount = ALL_LAB_FORMAT_KEYS.filter((k) => prev[k]).length;
        if (enabledCount <= 1) return prev;
      }
      return { ...prev, [key]: checked };
    });
  };

  const selectedSlide =
    slides.find((s) => s.id === selectedId) ?? slides[0] ?? null;

  React.useEffect(() => {
    if (!selectedId && slides.length > 0) {
      setSelectedId(slides[0].id);
    }
  }, [selectedId, slides]);

  React.useEffect(() => {
    if (
      previewFormatOptions.length > 0 &&
      !previewFormatOptions.includes(previewFormat)
    ) {
      setPreviewFormat(previewFormatOptions[0]);
    } else if (
      previewFormatOptions.length === 0 &&
      exportFormatsEnabled.pdf &&
      previewFormat !== "pdf"
    ) {
      setPreviewFormat("pdf");
    }
  }, [previewFormat, previewFormatOptions, exportFormatsEnabled.pdf]);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(DECK_STORAGE_KEY);
      if (raw) {
        const parsed = parseStoredDeck(raw);
        if (parsed) {
          setSlides(parsed.slides);
          setCaptions(parsed.captions ?? EMPTY_CAPTIONS);
          setSelectedId(parsed.slides[0]?.id ?? null);
        }
      }
    } catch {
      /* ignore */
    }
    setDeckHydrated(true);
  }, []);

  React.useEffect(() => {
    if (!deckHydrated) return;
    try {
      localStorage.setItem(DECK_STORAGE_KEY, serializeDeck(slides, captions));
    } catch {
      /* ignore */
    }
  }, [slides, captions, deckHydrated]);

  React.useEffect(() => {
    return () => {
      for (const slide of slidesRef.current) {
        revokeBlobUrl(slide.imageUrl);
        revokeBlobUrl(slide.partnerLogoUrl);
      }
    };
  }, []);

  React.useEffect(() => {
    loadRecoloredLogo()
      .then((img) => {
        logoRef.current = img;
        setLogoLoaded(true);
        setLogoError(null);
        bumpPreview();
      })
      .catch((err) => {
        setLogoLoaded(false);
        setLogoError(err instanceof Error ? err.message : "Logo load failed");
      });
  }, [bumpPreview]);

  React.useEffect(() => {
    const urls = new Set(
      slides.map((s) => s.imageUrl).filter((u): u is string => !!u),
    );
    for (const [url] of slideImagesRef.current) {
      if (!urls.has(url)) slideImagesRef.current.delete(url);
    }
    for (const url of urls) {
      if (slideImagesRef.current.has(url)) continue;
      void loadImageFromUrl(url).then((img) => {
        slideImagesRef.current.set(url, img);
        bumpPreview();
      });
    }
  }, [slides, bumpPreview]);

  React.useEffect(() => {
    const urls = new Set(
      slides.map((s) => s.partnerLogoUrl).filter((u): u is string => !!u),
    );
    for (const [url] of partnerLogosRef.current) {
      if (!urls.has(url)) partnerLogosRef.current.delete(url);
    }
    for (const url of urls) {
      if (partnerLogosRef.current.has(url)) continue;
      void loadImageFromUrl(url).then((img) => {
        partnerLogosRef.current.set(url, img);
        bumpPreview();
      });
    }
  }, [slides, bumpPreview]);

  React.useEffect(() => {
    if (logoLoaded) bumpPreview();
  }, [logoLoaded, selectedSlide, previewFormat, bumpPreview]);

  React.useEffect(() => {
    if (!lightboxUrl) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") setLightboxUrl(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxUrl]);

  const updateSlide = (id: string, patch: Partial<LabSlide>) => {
    setSlides((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    );
  };

  const changeSlideType = (id: string, newType: SlideType) => {
    setSlides((prev) =>
      prev.map((s) => (s.id === id ? applySlideTypeChange(s, newType) : s)),
    );
  };

  const addSlide = (type: SlideType = "eventPhoto") => {
    const slide = createSlide(type);
    setSlides((prev) => [...prev, slide]);
    setSelectedId(slide.id);
  };

  const duplicateSlide = (id: string) => {
    setSlides((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      if (idx < 0) return prev;
      const copy = { ...prev[idx], id: crypto.randomUUID() };
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });
  };

  const deleteSlide = (id: string) => {
    setSlides((prev) => {
      if (prev.length <= 1) return prev;
      const removed = prev.find((s) => s.id === id);
      if (removed) {
        revokeBlobUrl(removed.imageUrl);
        revokeBlobUrl(removed.partnerLogoUrl);
      }
      const next = prev.filter((s) => s.id !== id);
      if (selectedId === id) setSelectedId(next[0]?.id ?? null);
      return next;
    });
  };

  const moveSlideTo = (id: string, targetIndex: number) => {
    setSlides((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      if (idx < 0) return prev;
      const clamped = Math.max(0, Math.min(prev.length - 1, targetIndex));
      if (clamped === idx) return prev;
      const next = [...prev];
      const [item] = next.splice(idx, 1);
      next.splice(clamped, 0, item);
      return next;
    });
  };

  const reorderSlides = (dragId: string, targetId: string) => {
    const targetIndex = slides.findIndex((s) => s.id === targetId);
    if (targetIndex >= 0) moveSlideTo(dragId, targetIndex);
  };

  const handleImageUpload = (
    file: File | undefined,
    field: "imageUrl" | "partnerLogoUrl",
  ) => {
    if (!file || !file.type.startsWith("image/") || !selectedSlide) return;
    const url = URL.createObjectURL(file);
    const prevUrl =
      field === "imageUrl"
        ? selectedSlide.imageUrl
        : selectedSlide.partnerLogoUrl;

    if (field === "imageUrl") {
      void loadImageFromUrl(url).then((img) => {
        slideImagesRef.current.set(url, img);
        updateSlide(selectedSlide.id, {
          imageUrl: url,
          imageEdits: DEFAULT_IMAGE_EDIT_SETTINGS,
        });
        revokeBlobUrl(prevUrl);
        setPhotoNaturalSize({
          width: img.naturalWidth || img.width,
          height: img.naturalHeight || img.height,
        });
        setPhotoEditModalOpen(true);
        bumpPreview();
      });
    } else {
      void loadImageFromUrl(url).then((img) => {
        partnerLogosRef.current.set(url, img);
        updateSlide(selectedSlide.id, { partnerLogoUrl: url });
        revokeBlobUrl(prevUrl);
        bumpPreview();
      });
    }
  };

  const clearSlideImage = (field: "imageUrl" | "partnerLogoUrl") => {
    if (!selectedSlide) return;
    const prevUrl =
      field === "imageUrl"
        ? selectedSlide.imageUrl
        : selectedSlide.partnerLogoUrl;
    if (field === "imageUrl") {
      if (prevUrl) slideImagesRef.current.delete(prevUrl);
      updateSlide(selectedSlide.id, { imageUrl: null, imageEdits: undefined });
      setPhotoEditModalOpen(false);
      setPhotoNaturalSize(null);
    } else {
      if (prevUrl) partnerLogosRef.current.delete(prevUrl);
      updateSlide(selectedSlide.id, { partnerLogoUrl: null });
    }
    revokeBlobUrl(prevUrl);
    bumpPreview();
  };

  const openPhotoEdit = () => {
    if (!selectedSlide?.imageUrl) return;
    const img = slideImagesRef.current.get(selectedSlide.imageUrl);
    if (img) {
      setPhotoNaturalSize({
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
      });
    }
    setPhotoEditModalOpen(true);
  };

  const handleDownloadAllAssets = async () => {
    const logo = logoRef.current;
    if (!logo) {
      setExportHint("Logo wird noch geladen …");
      return;
    }
    if (slides.length === 0) {
      setExportHint("Keine Slides im Deck.");
      return;
    }

    const pngFormatKeys = enabledPngFormats;
    const includePdf = exportFormatsEnabled.pdf;
    if (pngFormatKeys.length === 0 && !includePdf) {
      setExportHint("Mindestens ein Exportformat auswählen.");
      return;
    }

    const title = deckExportTitle(slides);
    const captionMissing = collectCaptionZipMissing(
      captions,
      title,
      LAB_CAPTION_PLATFORMS,
    );
    if (captionMissing.length > 0) {
      setExportHint(`Es fehlen noch: ${captionMissing.join(", ")}.`);
      return;
    }

    setExportHint(null);
    const zip = new JSZip();
    const downloadDate = new Date();
    const offscreen = document.createElement("canvas");
    const assets: RenderAssets = {
      logo,
      slideImages: slideImagesRef.current,
      partnerLogos: partnerLogosRef.current,
    };

    const pngArchiveEntries: {
      formatKey: LabFormatKey;
      label: string;
      filename: string;
    }[] = [];

    for (const formatKey of pngFormatKeys) {
      const cfg = FORMAT_CONFIG[formatKey];
      slides.forEach((slide, i) => {
        renderLabSlide(offscreen, slide, formatKey, assets);
        const dataUrl = offscreen.toDataURL("image/png");
        const base64 = dataUrl.split(",")[1];
        const slideSuffix = slides.length > 1 ? `_slide-${i + 1}` : "";
        const name = `${exportAssetBasename(title, `${cfg.exportSlug}${slideSuffix}`, downloadDate)}.png`;
        pngArchiveEntries.push({
          formatKey,
          label: cfg.label,
          filename: name,
        });
        zip.file(name, base64, { base64: true });
      });
    }

    let pdfFilename: string | null = null;
    if (includePdf) {
      const pdf = new jsPDF({ unit: "px", format: [1080, 1080], compress: true });
      slides.forEach((slide, i) => {
        renderLabSlide(offscreen, slide, "pdf", assets);
        const dataUrl = offscreen.toDataURL("image/png");
        if (i > 0) pdf.addPage([1080, 1080], "p");
        pdf.addImage(dataUrl, "PNG", 0, 0, 1080, 1080);
      });

      pdfFilename = `${exportAssetBasename(title, "VDID-Lab-Deck", downloadDate)}.pdf`;
      zip.file(pdfFilename, pdf.output("blob"));
    }

    const captionTxtArchiveEntries = addCaptionsToZip(
      zip,
      title,
      captions,
      downloadDate,
      LAB_CAPTION_PLATFORMS,
    );

    const zipBasename = exportAssetBasename(title, "all-formats", downloadDate);
    const zipDownloadFilename = `${zipBasename}.zip`;
    const jsonBasename = exportAssetBasename(title, "asset-export", downloadDate);
    const jsonFilename = `${jsonBasename}.json`;

    const exportManifest = {
      export: {
        generatedAt: downloadDate.toISOString(),
        zipArchiveFilename: zipDownloadFilename,
        manifestFilename: jsonFilename,
      },
      texts: {
        deckTitle: title,
        captions: {
          instagram: captions.captionInstagram,
          linkedin: captions.captionLinkedIn,
        },
        slides: slides.map((s, i) => ({
          index: i + 1,
          type: s.type,
          heading: s.heading,
          dateLine: s.dateLine,
        })),
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
        pdfFilename,
      },
    };

    zip.file(jsonFilename, JSON.stringify(exportManifest, null, 2));

    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = zipDownloadFilename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleZipButtonClick = () => {
    if (enabledExportFormats.length === 0) {
      setExportHint("Mindestens ein Exportformat auswählen.");
      return;
    }
    void handleDownloadAllAssets();
  };

  const handleCopyCaptionPrompt = React.useCallback(async () => {
    const prompt = buildAllCaptionTipsLlmPrompt(
      "Socials — aktuelle Eingaben",
      formatLabDeckForLlmPrompt(slides, captions),
      "Socials",
      LAB_CAPTION_PLATFORMS,
    );
    try {
      await navigator.clipboard.writeText(prompt);
    } catch {
      /* clipboard API unavailable */
    }
  }, [slides, captions]);

  const updateCaption = (field: keyof CaptionSet, value: string) => {
    setCaptions((prev) => ({ ...prev, [field]: value }));
  };

  const openLightboxForSlide = (slideId: string) => {
    const slide = slides.find((s) => s.id === slideId);
    const logo = logoRef.current;
    if (!slide || !logo || !logoLoaded) return;

    const canvas = document.createElement("canvas");
    renderLabSlide(canvas, slide, previewFormat, {
      logo,
      slideImages: slideImagesRef.current,
      partnerLogos: partnerLogosRef.current,
    });
    setLightboxUrl(canvas.toDataURL("image/png"));
  };

  const showFormatLabel =
    selectedSlide?.type === "title" ||
    selectedSlide?.type === "eventPhoto" ||
    selectedSlide?.type === "coBranded" ||
    selectedSlide?.type === "freeform";
  const showImage =
    selectedSlide?.type === "eventPhoto" ||
    selectedSlide?.type === "coBranded" ||
    selectedSlide?.type === "freeform";
  const showPartnerLogo = selectedSlide?.type === "coBranded";
  const showDateLine =
    selectedSlide?.type === "title" ||
    selectedSlide?.type === "eventPhoto" ||
    selectedSlide?.type === "coBranded";
  const showNameRole = selectedSlide?.type === "quote";
  const showPresenter =
    selectedSlide?.type === "eventPhoto" || selectedSlide?.type === "freeform";
  const showContact = selectedSlide?.type === "cta";

  return (
    <>
      <div className="space-y-6">
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Vorschau</CardTitle>
            {previewFormatOptions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {previewFormatOptions.map((key) => (
                  <Button
                    key={key}
                    type="button"
                    size="sm"
                    variant={previewFormat === key ? "default" : "outline"}
                    onClick={() => setPreviewFormat(key)}
                  >
                    {key === "instagramPost"
                      ? "IG Post"
                      : key === "instagramStory"
                        ? "IG Story"
                        : "LinkedIn"}
                  </Button>
                ))}
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
              <LabSlidePreviewStrip
                slides={slides}
                selectedId={selectedSlide?.id ?? null}
                previewFormat={FORMAT_CONFIG[previewFormat]}
                logoRef={logoRef}
                slideImagesRef={slideImagesRef}
                partnerLogosRef={partnerLogosRef}
                logoLoaded={logoLoaded}
                previewRevision={previewRevision}
                maxHeight={480}
                onAddSlide={() => addSlide()}
                onSlideClick={openLightboxForSlide}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Formate</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-600">
              Wähle die Ausgabeformate für das ZIP-Archiv.
            </p>
            <LabFormatPicker
              enabled={exportFormatsEnabled}
              onToggle={toggleExportFormat}
            />
          </CardContent>
        </Card>

        {selectedSlide && (
          <Card>
            <CardHeader className="flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Post</CardTitle>
              <PostSlideOrderBar
                slides={slides}
                selectedId={selectedSlide.id}
                onSelect={setSelectedId}
                onReorder={reorderSlides}
                onDuplicate={duplicateSlide}
                onDelete={deleteSlide}
              />
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label>Vorlage</Label>
                <SlideTemplatePicker
                  value={selectedSlide.type}
                  onChange={(type) =>
                    changeSlideType(selectedSlide.id, type)
                  }
                />
              </div>
                  {showFormatLabel && (
                    <div className="space-y-1 md:col-span-2">
                      <Label htmlFor="formatLabel">Formatzeile</Label>
                      <select
                        id="formatLabel"
                        value={selectedSlide.formatLabel ?? ""}
                        onChange={(e) =>
                          updateSlide(selectedSlide.id, {
                            formatLabel: e.target.value,
                          })
                        }
                        className="flex h-10 w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm text-slate-900 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        {!selectedSlide.formatLabel?.trim() && (
                          <option value="" disabled>
                            Format wählen…
                          </option>
                        )}
                        {formatLineSelectOptions(selectedSlide.formatLabel).map(
                          (option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ),
                        )}
                      </select>
                    </div>
                  )}
                  <div className="space-y-1 md:col-span-2">
                    <Label htmlFor="heading">Titel</Label>
                    <Input
                      id="heading"
                      value={selectedSlide.heading ?? ""}
                      onChange={(e) =>
                        updateSlide(selectedSlide.id, { heading: e.target.value })
                      }
                      placeholder="**Fett & blau**, *kursiv*, __fett__"
                    />
                    <p className="text-xs text-slate-500">{MARKDOWN_FORMAT_HINT}</p>
                  </div>
                  {(selectedSlide.type === "quote" ||
                    selectedSlide.type === "cta" ||
                    selectedSlide.type === "freeform") && (
                    <div className="space-y-1 md:col-span-2">
                      <Label htmlFor="body">Text</Label>
                      <Textarea
                        id="body"
                        value={selectedSlide.body ?? ""}
                        onChange={(e) =>
                          updateSlide(selectedSlide.id, { body: e.target.value })
                        }
                        placeholder="Text mit Markdown — z. B. *kursiv* oder **hervorgehoben**"
                        rows={4}
                        className="resize-y"
                      />
                      <p className="text-xs text-slate-500">{MARKDOWN_FORMAT_HINT}</p>
                    </div>
                  )}
                  {showDateLine && (
                    <div className="md:col-span-2">
                      <LabDateLineFields
                        value={selectedSlide.dateLine ?? ""}
                        onChange={(dateLine) =>
                          updateSlide(selectedSlide.id, { dateLine })
                        }
                      />
                    </div>
                  )}
                  {showNameRole && (
                    <>
                      <div className="space-y-1">
                        <Label htmlFor="name">Name</Label>
                        <Input
                          id="name"
                          value={selectedSlide.name ?? ""}
                          onChange={(e) =>
                            updateSlide(selectedSlide.id, { name: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="role">Rolle</Label>
                        <Input
                          id="role"
                          value={selectedSlide.role ?? ""}
                          onChange={(e) =>
                            updateSlide(selectedSlide.id, { role: e.target.value })
                          }
                        />
                      </div>
                    </>
                  )}
                  {showPresenter && (
                    <div className="space-y-1 md:col-span-2">
                      <Label htmlFor="presenter">Name</Label>
                      <Input
                        id="presenter"
                        value={selectedSlide.name ?? ""}
                        onChange={(e) =>
                          updateSlide(selectedSlide.id, { name: e.target.value })
                        }
                        placeholder="Name / mit …"
                      />
                    </div>
                  )}
                  {showContact && (
                    <div className="space-y-1 md:col-span-2">
                      <Label htmlFor="contact">Kontakt</Label>
                      <Input
                        id="contact"
                        value={selectedSlide.contact ?? ""}
                        onChange={(e) =>
                          updateSlide(selectedSlide.id, {
                            contact: e.target.value,
                          })
                        }
                        placeholder="Anmeldungen an **mail@vdid.de**"
                      />
                      <p className="text-xs text-slate-500">{MARKDOWN_FORMAT_HINT}</p>
                    </div>
                  )}
                  {!showImage && !showPartnerLogo && (
                    <p className="text-xs text-slate-500 md:col-span-2">
                      Foto-Upload ist bei den Vorlagen{" "}
                      <strong>Event mit Foto</strong>, <strong>Co-Branding</strong>{" "}
                      und <strong>Freitext</strong> verfügbar.
                    </p>
                  )}
                  {showImage && (
                    <SlideImageUploadField
                      id="slidePhoto"
                      label="Foto"
                      hint="Wird im Bildbereich der Slide angezeigt."
                      imageUrl={selectedSlide.imageUrl}
                      onUpload={(file) => handleImageUpload(file, "imageUrl")}
                      onClear={() => clearSlideImage("imageUrl")}
                      onEdit={openPhotoEdit}
                    />
                  )}
                  {showPartnerLogo && (
                    <SlideImageUploadField
                      id="partnerLogo"
                      label="Partner-Logo"
                      hint="Erscheint unten rechts neben dem VDID-Logo."
                      imageUrl={selectedSlide.partnerLogoUrl}
                      onUpload={(file) =>
                        handleImageUpload(file, "partnerLogoUrl")
                      }
                      onClear={() => clearSlideImage("partnerLogoUrl")}
                    />
                  )}
            </CardContent>
          </Card>
        )}

        <CaptionFieldsCard
          captions={captions}
          onChange={updateCaption}
          onCopyPrompt={() => void handleCopyCaptionPrompt()}
          idPrefix="lab-caption"
        />

        <Card>
          <CardHeader>
            <CardTitle>Export</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-600">
              Bilder, Captions (.txt), PDF und Manifest als ZIP.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={!logoLoaded || enabledExportFormats.length === 0}
                onClick={handleZipButtonClick}
              >
                ZIP herunterladen
                {enabledExportFormats.length < ALL_LAB_FORMAT_KEYS.length && (
                  <span className="ml-1 font-normal opacity-80">
                    ({enabledExportFormats.length} Formate)
                  </span>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  for (const slide of slidesRef.current) {
                    revokeBlobUrl(slide.imageUrl);
                    revokeBlobUrl(slide.partnerLogoUrl);
                  }
                  setSlides([createSlide("eventPhoto")]);
                  setCaptions(EMPTY_CAPTIONS);
                  setSelectedId(null);
                  setExportFormatsEnabled(allLabFormatsEnabled());
                  try {
                    localStorage.removeItem(DECK_STORAGE_KEY);
                  } catch {
                    /* ignore */
                  }
                }}
              >
                Zurücksetzen
              </Button>
            </div>
            {exportHint && (
              <p className="text-sm text-red-700" role="status">
                {exportHint}
              </p>
            )}
          </CardContent>
        </Card>

        <div>
          {!logoLoaded && !logoError && (
            <p className="mt-2 text-xs text-slate-500">Logo wird geladen …</p>
          )}
          {logoError && (
            <p className="mt-2 text-xs text-red-700">{logoError}</p>
          )}
        </div>
      </div>

      <ImageEditModal
        open={photoEditModalOpen && !!selectedSlide?.imageUrl}
        onClose={() => setPhotoEditModalOpen(false)}
        title="Foto bearbeiten"
        imageUrl={selectedSlide?.imageUrl ?? null}
        naturalSize={photoNaturalSize}
        settings={selectedSlide?.imageEdits ?? DEFAULT_IMAGE_EDIT_SETTINGS}
        onSettingsChange={(imageEdits) => {
          if (selectedSlide) {
            updateSlide(selectedSlide.id, { imageEdits });
          }
        }}
        onFileSelected={(file) => handleImageUpload(file, "imageUrl")}
        onClearImage={() => clearSlideImage("imageUrl")}
        idPrefix="lab-photo"
        uploadHint="PNG, JPG, WebP …"
      />

      {typeof document !== "undefined" &&
        lightboxUrl &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-6"
            role="dialog"
            aria-modal="true"
            aria-label="Slide Vorschau"
            onClick={() => setLightboxUrl(null)}
          >
            <img
              src={lightboxUrl}
              alt="Slide Vorschau"
              className="max-h-[min(90vh,100%)] max-w-[min(90vw,100%)] object-contain shadow-2xl"
              onClick={(e) => e.stopPropagation()}
              draggable={false}
            />
          </div>,
          document.body,
        )}
    </>
  );
}

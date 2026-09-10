"use client";

import React from "react";
import { createPortal } from "react-dom";
import JSZip from "jszip";
import { jsPDF } from "jspdf";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { loadRgbLogo, loadSwLogo, loadWhiteLogo } from "@/lib/lab-logo";
import { exportAssetBasename } from "@/lib/export-naming";
import {
  EXPORT_IMAGE_EXT,
  EXPORT_IMAGE_FORMAT_LABELS,
  EXPORT_IMAGE_FORMATS,
  allExportImageFormatsEnabled,
  canvasToExportDataUrl,
  type ExportImageFormat,
} from "@/lib/export-image";
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
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  DEFAULT_IMAGE_EDIT_SETTINGS,
  type ImageEditSettings,
} from "@/lib/image-edit";
import {
  renderLabSlideToContext,
  type LabSlide,
  type LabLogoStyle,
  type SlideType,
  type RenderAssets,
  primaryLogoForStyle,
} from "@/lib/lab-slide-render";
import {
  CANVAS_BREAK_HINT,
  MARKDOWN_FORMAT_HINT,
  stripMarkdown,
} from "@/lib/canvas-richtext";
import { onCanvasTextareaKeyDown } from "@/components/vdidlab/custom-template-fields";
import { LabDateLineFields } from "@/components/vdidlab/lab-date-line-fields";
import { LabSlidePreviewStrip } from "@/components/vdidlab/lab-slide-preview-strip";
import { PostSlideOrderBar } from "@/components/vdidlab/post-slide-order-bar";
import {
  SlideTemplatePicker,
} from "@/components/vdidlab/slide-template-picker";
import { CustomTemplateFields } from "@/components/vdidlab/custom-template-fields";
import {
  ExportProgressButton,
  progressPercent,
  useRafProgress,
  type MotionProgressValue,
  type ZipExportPhase,
} from "@/components/vdidlab/motion-export-controls";
import { TemplateEditorModal } from "@/components/vdidlab/template-editor/template-editor-modal";
import {
  defaultContentForTemplate,
  loadCustomTemplatesFromStorage,
  saveCustomTemplatesToStorage,
  type CustomSlideImageSlot,
  type CustomTemplate,
} from "@/lib/custom-template";
import { publicFile } from "@/lib/public-file";
import { loadBundledImages, probePublicVideo } from "@/lib/bundled-image";
import { encodeSlideGif, encodeSlideVideo } from "@/lib/export-motion";
import {
  WDC_BG_FILE,
  WDC_STORAGE_KEY,
  WDC_VIDEO_CANDIDATES,
  parseWdcPlateMode,
  type WdcPlateMode,
} from "@/lib/wdc-theme";
import { WdcPlateModePicker } from "@/components/vdidlab/wdc-plate-mode-picker";
import { get2dContext } from "@/lib/hdr-headline";
import {
  WDC_DEFAULT_TEMPLATE_ID,
  WDC_TEMPLATE_CAPTIONS,
  WDC_TEMPLATES,
  collectWdcAssetSrcs,
} from "@/lib/wdc-templates";

export type { LabSlide, SlideType };
export type { LabFormatKey } from "@/lib/lab-formats";
export type LabGeneratorFamily = "lab" | "wdc";

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

const PREVIEW_FORMAT_TAB_LABELS: Record<
  Exclude<LabFormatKey, "pdf">,
  string
> = {
  instagramPost: "IG Post",
  instagramStory: "IG Story",
  linkedin: "LinkedIn",
};

const FORMAT_SHORT_LABEL: Record<LabFormatKey, string> = {
  instagramPost: "IG Post",
  instagramStory: "IG Story",
  linkedin: "LinkedIn",
  pdf: "PDF",
};

function zipPhaseLabel(phase: ZipExportPhase, detail?: string) {
  const suffix = detail ? ` · ${detail}` : "";
  switch (phase) {
    case "images":
      return `Bilder${suffix}`;
    case "pdf":
      return "PDF";
    case "gif":
      return `GIF${suffix}`;
    case "video":
      return `MP4${suffix}`;
    case "zip":
      return "ZIP";
  }
}

function yieldToUi() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

const ALL_LAB_FORMAT_KEYS = LAB_FORMAT_KEYS;

function allLabFormatsEnabled(): Record<LabFormatKey, boolean> {
  return Object.fromEntries(
    ALL_LAB_FORMAT_KEYS.map((k) => [k, true]),
  ) as Record<LabFormatKey, boolean>;
}

const DECK_STORAGE_KEY = "vdid-lab-deck-v1";
const LOGO_STYLE_STORAGE_KEY = "vdid-lab-logo-style-v1";

const FORMAT_LINE_OPTIONS = [
  "VDID Fortbildung",
  "VDID Design.Wissen.Diskurs.",
  "14. VDID Designer's Breakfast",
] as const;

const FORMAT_LINE_OTHER = "__other__";

function formatLinePresetValue(formatLabel: string | undefined): string {
  const value = formatLabel?.trim() ?? "";
  if (FORMAT_LINE_OPTIONS.includes(value as (typeof FORMAT_LINE_OPTIONS)[number])) {
    return value;
  }
  return "";
}

function isFormatLineCustom(formatLabel: string | undefined): boolean {
  const value = formatLabel?.trim() ?? "";
  return value !== "" && !FORMAT_LINE_OPTIONS.includes(value as (typeof FORMAT_LINE_OPTIONS)[number]);
}

function revokeCustomSlideImages(slide: LabSlide) {
  if (!slide.images) return;
  for (const slot of Object.values(slide.images)) {
    revokeBlobUrl(slot.url);
  }
}

function collectCustomImageUrls(
  slides: LabSlide[],
  templates: Map<string, CustomTemplate>,
): { photoUrls: Set<string>; partnerUrls: Set<string> } {
  const photoUrls = new Set<string>();
  const partnerUrls = new Set<string>();
  for (const slide of slides) {
    if (slide.type !== "custom" || !slide.images || !slide.customTemplateId) continue;
    const template = templates.get(slide.customTemplateId);
    if (!template) continue;
    for (const el of template.elements) {
      if (el.kind !== "image" && el.kind !== "partnerLogo") continue;
      const url = slide.images[el.slot]?.url;
      if (!url) continue;
      if (el.kind === "partnerLogo") partnerUrls.add(url);
      else photoUrls.add(url);
    }
  }
  return { photoUrls, partnerUrls };
}

function createCustomSlide(
  templateId: string,
  templates: CustomTemplate[],
): LabSlide {
  const template = templates.find((t) => t.id === templateId);
  const content = template
    ? defaultContentForTemplate(template)
    : { fields: {}, images: {} };
  return {
    id: crypto.randomUUID(),
    type: "custom",
    customTemplateId: templateId,
    fields: content.fields,
    images: content.images,
    formatLabel: "",
    heading: "",
    body: "",
    dateLine: "",
    name: "",
    role: "",
    contact: "",
    imageUrl: null,
    partnerLogoUrl: null,
    plateMode: "animated",
  };
}

function slidesForStorage(slides: LabSlide[]): LabSlide[] {
  return slides.map((s) => ({
    ...s,
    imageUrl: s.imageUrl?.startsWith("blob:") ? null : s.imageUrl,
    partnerLogoUrl: s.partnerLogoUrl?.startsWith("blob:") ? null : s.partnerLogoUrl,
    images: s.images
      ? Object.fromEntries(
          Object.entries(s.images).map(([key, slot]) => [
            key,
            {
              ...slot,
              url: slot.url?.startsWith("blob:") ? null : slot.url,
            },
          ]),
        )
      : undefined,
  }));
}

function createSlide(type: SlideType): LabSlide {
  const defaults: Partial<Record<SlideType, Partial<LabSlide>>> = {
    title: {
      formatLabel: "VDID Fortbildung",
      heading: "VDID Event",
      dateLine: "01.01.2026 | 10:00",
    },
    quote: {
      heading: "Zum Event sagt",
      body: "„Ein **überzeugendes** Zitat zur Veranstaltung.“",
      name: "Name",
      role: "Rolle",
    },
    cta: {
      heading: "Jetzt anmelden",
      body: "Kurzer Text mit Handlungsaufforderung zum Event.",
      contact: "Anmeldungen an **mail@vdid.de**",
    },
    eventPhoto: {
      formatLabel: "VDID Design.Wissen.Diskurs.",
      heading: "VDID Event",
      dateLine: "01.01.2026 | 18:00",
      name: "mit Name",
    },
    fullImage: {},
    coBranded: {
      formatLabel: "VDID Design.Wissen.Diskurs.",
      heading: "VDID Event",
      dateLine: "01.01.2026 | 10:00",
    },
    freeform: {
      heading: "Titel",
      body: "Text",
      name: "Name",
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
  return JSON.stringify({
    slides: slidesForStorage(slides),
    captions,
  } satisfies StoredDeck);
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
        plateMode: parseWdcPlateMode(s.plateMode),
        customTemplateId: s.customTemplateId,
        fields: s.fields,
        images: s.images,
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
  const ctx = get2dContext(canvas);
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
  for (const slide of slides) {
    if (slide.type === "custom" && slide.fields) {
      const first = Object.values(slide.fields).find((v) => v.trim());
      if (first) return stripMarkdown(first);
    }
  }
  return "vdid-lab-deck";
}

function applySlideTypeChange(slide: LabSlide, newType: SlideType): LabSlide {
  if (slide.type === newType && newType !== "custom") return slide;
  if (slide.type === "custom") {
    revokeCustomSlideImages(slide);
  }
  if (newType === "custom") return slide;

  const defaults = createSlide(newType);
  const supportsImage =
    newType === "eventPhoto" ||
    newType === "fullImage" ||
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
    customTemplateId: undefined,
    fields: undefined,
    images: undefined,
  };
}

function revokeBlobUrl(url: string | null | undefined) {
  if (url?.startsWith("blob:")) {
    URL.revokeObjectURL(url);
  }
}

function imageSlotDefaultEdits(
  template: CustomTemplate | null | undefined,
  slot: string,
): ImageEditSettings {
  const el = template?.elements.find(
    (item) => item.kind === "image" && item.slot === slot,
  );
  return el?.kind === "image"
    ? (el.defaultEdits ?? DEFAULT_IMAGE_EDIT_SETTINGS)
    : DEFAULT_IMAGE_EDIT_SETTINGS;
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

export function VdidLabGenerator({
  family = "lab",
}: {
  family?: LabGeneratorFamily;
}) {
  const isWdc = family === "wdc";
  const deckStorageKey = isWdc ? WDC_STORAGE_KEY : DECK_STORAGE_KEY;
  const [slides, setSlides] = React.useState<LabSlide[]>(() =>
    isWdc
      ? [createCustomSlide(WDC_DEFAULT_TEMPLATE_ID, WDC_TEMPLATES)]
      : [createSlide("eventPhoto")],
  );
  const [captions, setCaptions] = React.useState<CaptionSet>(EMPTY_CAPTIONS);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [previewFormat, setPreviewFormat] = React.useState<LabFormatKey>(
    isWdc ? "linkedin" : "instagramPost",
  );
  const [deckHydrated, setDeckHydrated] = React.useState(false);
  const [logoLoaded, setLogoLoaded] = React.useState(false);
  const [logoError, setLogoError] = React.useState<string | null>(null);
  const logoRef = React.useRef<HTMLImageElement | null>(null);
  const logoRgbRef = React.useRef<HTMLImageElement | null>(null);
  const logoBwRef = React.useRef<HTMLImageElement | null>(null);
  const logoWhiteRef = React.useRef<HTMLImageElement | null>(null);
  const slideImagesRef = React.useRef<Map<string, HTMLImageElement>>(new Map());
  const partnerLogosRef = React.useRef<Map<string, HTMLImageElement>>(new Map());
  const customTemplatesRef = React.useRef<Map<string, CustomTemplate>>(
    isWdc ? new Map(WDC_TEMPLATES.map((t) => [t.id, t])) : new Map(),
  );
  const bundledImagesRef = React.useRef<Map<string, HTMLImageElement>>(new Map());
  const backgroundVideoRef = React.useRef<HTMLVideoElement | null>(null);
  const postFormRef = React.useRef<HTMLDivElement>(null);
  const slidesRef = React.useRef(slides);
  slidesRef.current = slides;
  const [lightboxUrl, setLightboxUrl] = React.useState<string | null>(null);
  const [exportHint, setExportHint] = React.useState<string | null>(null);
  const [exportFormatsEnabled, setExportFormatsEnabled] = React.useState<
    Record<LabFormatKey, boolean>
  >(allLabFormatsEnabled);
  const [exportImageFormatsEnabled, setExportImageFormatsEnabled] =
    React.useState<Record<ExportImageFormat, boolean>>(
      allExportImageFormatsEnabled,
    );
  const [exportGifEnabled, setExportGifEnabled] = React.useState(false);
  const [exportMp4Enabled, setExportMp4Enabled] = React.useState(false);
  const [photoEditModalOpen, setPhotoEditModalOpen] = React.useState(false);
  const [photoEditSlot, setPhotoEditSlot] = React.useState<string | "plate" | null>(
    null,
  );
  const [slideDeleteId, setSlideDeleteId] = React.useState<string | null>(null);
  const [photoNaturalSize, setPhotoNaturalSize] = React.useState<{
    width: number;
    height: number;
  } | null>(null);
  const [previewRevision, setPreviewRevision] = React.useState(0);
  const [formatLineOtherMode, setFormatLineOtherMode] = React.useState(false);
  const [logoStyle, setLogoStyle] = React.useState<LabLogoStyle>("color");
  const [customTemplates, setCustomTemplates] = React.useState<CustomTemplate[]>(
    isWdc ? WDC_TEMPLATES : [],
  );
  const [templateEditorOpen, setTemplateEditorOpen] = React.useState(false);
  const [customTemplatesHydrated, setCustomTemplatesHydrated] = React.useState(isWdc);
  const [videoReady, setVideoReady] = React.useState(false);
  const [zipBusy, setZipBusy] = React.useState<ZipExportPhase | null>(null);
  const [zipBusyDetail, setZipBusyDetail] = React.useState<string | undefined>();
  const zipProgressRef = React.useRef<MotionProgressValue>({
    done: 0,
    total: 1,
  });
  const zipLockRef = React.useRef(false);
  const zipProgress = useRafProgress(zipProgressRef, zipBusy != null);
  const zipPercent = progressPercent(zipBusy ? zipProgress : null);
  const zipStarted = (zipBusy ? zipProgress.done : 0) > 0;

  const bumpPreview = React.useCallback(() => {
    setPreviewRevision((revision) => revision + 1);
  }, []);

  const enabledExportFormats = React.useMemo(
    () => ALL_LAB_FORMAT_KEYS.filter((key) => exportFormatsEnabled[key]),
    [exportFormatsEnabled],
  );

  const previewFormatOptions = React.useMemo(
    (): Exclude<LabFormatKey, "pdf">[] =>
      ALL_LAB_FORMAT_KEYS.filter(
        (key): key is Exclude<LabFormatKey, "pdf"> =>
          exportFormatsEnabled[key] && key !== "pdf",
      ),
    [exportFormatsEnabled],
  );

  const enabledRasterFormats = React.useMemo(
    () => enabledExportFormats.filter((key) => key !== "pdf"),
    [enabledExportFormats],
  );

  const enabledImageFormats = React.useMemo(
    () => EXPORT_IMAGE_FORMATS.filter((f) => exportImageFormatsEnabled[f]),
    [exportImageFormatsEnabled],
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

  const toggleExportImageFormat = (
    format: ExportImageFormat,
    checked: boolean,
  ) => {
    setExportImageFormatsEnabled((prev) => {
      if (!checked) {
        const enabledCount = EXPORT_IMAGE_FORMATS.filter((f) => prev[f]).length;
        if (enabledCount <= 1 && enabledRasterFormats.length > 0) return prev;
      }
      return { ...prev, [format]: checked };
    });
  };

  const selectedSlide =
    slides.find((s) => s.id === selectedId) ?? slides[0] ?? null;

  React.useEffect(() => {
    if (!selectedSlide) return;
    setFormatLineOtherMode(isFormatLineCustom(selectedSlide.formatLabel));
  }, [selectedSlide?.id]);

  React.useEffect(() => {
    if (!selectedId && slides.length > 0) {
      setSelectedId(slides[0].id);
    }
  }, [selectedId, slides]);

  React.useEffect(() => {
    if (
      previewFormatOptions.length > 0 &&
      !previewFormatOptions.some((key) => key === previewFormat)
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
    if (isWdc) {
      customTemplatesRef.current = new Map(WDC_TEMPLATES.map((t) => [t.id, t]));
      setCustomTemplates(WDC_TEMPLATES);
      setCustomTemplatesHydrated(true);
      return;
    }
    const loaded = loadCustomTemplatesFromStorage();
    setCustomTemplates(loaded);
    customTemplatesRef.current = new Map(loaded.map((t) => [t.id, t]));
    setCustomTemplatesHydrated(true);
  }, [isWdc]);

  React.useEffect(() => {
    if (!customTemplatesHydrated || isWdc) return;
    customTemplatesRef.current = new Map(customTemplates.map((t) => [t.id, t]));
    saveCustomTemplatesToStorage(customTemplates);
    bumpPreview();
  }, [customTemplates, customTemplatesHydrated, bumpPreview, isWdc]);

  React.useEffect(() => {
    if (!isWdc) return;
    void loadBundledImages(collectWdcAssetSrcs()).then((images) => {
      bundledImagesRef.current = images;
      bumpPreview();
    });
    void probePublicVideo(WDC_VIDEO_CANDIDATES).then((video) => {
      backgroundVideoRef.current = video;
      if (!video) {
        setVideoReady(false);
        return;
      }
      void video.play().then(
        () => {
          setVideoReady(true);
          bumpPreview();
        },
        () => {
          setVideoReady(true);
          bumpPreview();
        },
      );
    });
  }, [isWdc, bumpPreview]);

  React.useEffect(() => {
    const video = backgroundVideoRef.current;
    if (!isWdc || !video || !videoReady) return;
    const animated =
      parseWdcPlateMode(selectedSlide?.plateMode) === "animated";
    if (animated) {
      void video.play().catch(() => undefined);
    } else {
      video.pause();
    }
    bumpPreview();
  }, [isWdc, videoReady, selectedSlide?.plateMode, bumpPreview]);

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(LOGO_STYLE_STORAGE_KEY);
      if (stored === "color" || stored === "bw") {
        setLogoStyle(stored);
      }
    } catch {
      /* ignore */
    }
  }, []);

  React.useEffect(() => {
    try {
      localStorage.setItem(LOGO_STYLE_STORAGE_KEY, logoStyle);
    } catch {
      /* ignore */
    }
  }, [logoStyle]);

  React.useEffect(() => {
    const rgb = logoRgbRef.current;
    const bw = logoBwRef.current;
    const active =
      logoStyle === "color" ? rgb : bw;
    if (active) {
      logoRef.current = active as HTMLImageElement;
      bumpPreview();
    }
  }, [logoStyle, logoLoaded, bumpPreview]);

  const buildRenderAssets = React.useCallback((): RenderAssets | null => {
    const rgb = logoRgbRef.current;
    const bw = logoBwRef.current;
    if (!rgb || !bw) return null;
    const logo = primaryLogoForStyle(logoStyle, { rgb, bw });
    logoRef.current = logo as HTMLImageElement;
    return {
      logoStyle,
      logo: isWdc && logoWhiteRef.current ? logoWhiteRef.current : logo,
      logoWhite: logoWhiteRef.current,
      slideImages: slideImagesRef.current,
      partnerLogos: partnerLogosRef.current,
      customTemplates: customTemplatesRef.current,
      bundledImages: bundledImagesRef.current,
      backgroundVideo: backgroundVideoRef.current,
    };
  }, [logoStyle, isWdc]);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(deckStorageKey);
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
  }, [deckStorageKey]);

  React.useEffect(() => {
    if (!deckHydrated) return;
    try {
      localStorage.setItem(deckStorageKey, serializeDeck(slides, captions));
    } catch {
      /* ignore */
    }
  }, [slides, captions, deckHydrated, deckStorageKey]);

  React.useEffect(() => {
    return () => {
      for (const slide of slidesRef.current) {
        revokeBlobUrl(slide.imageUrl);
        revokeBlobUrl(slide.partnerLogoUrl);
        revokeCustomSlideImages(slide);
      }
    };
  }, []);

  React.useEffect(() => {
    Promise.all([loadRgbLogo(), loadSwLogo(), loadWhiteLogo()])
      .then(([rgbLogo, bwLogo, whiteLogo]) => {
        logoRgbRef.current = rgbLogo;
        logoBwRef.current = bwLogo;
        logoWhiteRef.current = whiteLogo;
        logoRef.current = logoStyle === "color" ? rgbLogo : bwLogo;
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
    const custom = collectCustomImageUrls(slides, customTemplatesRef.current);
    for (const url of custom.photoUrls) urls.add(url);
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
    const custom = collectCustomImageUrls(slides, customTemplatesRef.current);
    for (const url of custom.partnerUrls) urls.add(url);
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
    const slide = isWdc
      ? createCustomSlide(WDC_DEFAULT_TEMPLATE_ID, WDC_TEMPLATES)
      : createSlide(type);
    setSlides((prev) => [...prev, slide]);
    setSelectedId(slide.id);
  };

  const changeCustomTemplate = (id: string, templateId: string) => {
    const catalog = isWdc ? WDC_TEMPLATES : customTemplates;
    setSlides((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        revokeCustomSlideImages(s);
        const next = createCustomSlide(templateId, catalog);
        return {
          ...next,
          id: s.id,
          imageEdits: s.imageEdits,
          plateMode: s.plateMode ?? next.plateMode,
        };
      }),
    );
  };

  const updateCustomField = (slideId: string, field: string, value: string) => {
    setSlides((prev) =>
      prev.map((s) =>
        s.id === slideId
          ? { ...s, fields: { ...s.fields, [field]: value } }
          : s,
      ),
    );
  };

  const handleCustomImageUpload = (
    slot: string,
    kind: "image" | "partnerLogo",
    file: File | undefined,
  ) => {
    if (!file || !file.type.startsWith("image/") || !selectedSlide) return;
    const url = URL.createObjectURL(file);
    const prevUrl = selectedSlide.images?.[slot]?.url;
    const mapRef = kind === "partnerLogo" ? partnerLogosRef : slideImagesRef;

    void loadImageFromUrl(url).then((img) => {
      mapRef.current.set(url, img);
      const catalog = isWdc ? WDC_TEMPLATES : customTemplates;
      const template = catalog.find(
        (item) => item.id === selectedSlide.customTemplateId,
      );
      const nextImages: Record<string, CustomSlideImageSlot> = {
        ...(selectedSlide.images ?? {}),
        [slot]: {
          url,
          edits:
            kind === "image"
              ? selectedSlide.images?.[slot]?.edits ??
                imageSlotDefaultEdits(template, slot)
              : undefined,
          whiteOverlay: selectedSlide.images?.[slot]?.whiteOverlay,
        },
      };
      updateSlide(selectedSlide.id, { images: nextImages });
      revokeBlobUrl(prevUrl);
      if (kind === "image") {
        setPhotoNaturalSize({
          width: img.naturalWidth || img.width,
          height: img.naturalHeight || img.height,
        });
        setPhotoEditSlot(slot);
        setPhotoEditModalOpen(true);
      }
      bumpPreview();
    });
  };

  const clearCustomImage = (
    slot: string,
    kind: "image" | "partnerLogo",
  ) => {
    if (!selectedSlide?.images) return;
    const prevUrl = selectedSlide.images[slot]?.url;
    const mapRef = kind === "partnerLogo" ? partnerLogosRef : slideImagesRef;
    if (prevUrl) mapRef.current.delete(prevUrl);
    const nextImages = {
      ...selectedSlide.images,
      [slot]: {
        url: null,
        edits: selectedSlide.images[slot]?.edits,
        whiteOverlay: selectedSlide.images[slot]?.whiteOverlay,
      },
    };
    updateSlide(selectedSlide.id, { images: nextImages });
    revokeBlobUrl(prevUrl);
    if (photoEditSlot === slot) closePhotoEdit();
    bumpPreview();
  };

  const duplicateSlide = (id: string) => {
    setSlides((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      if (idx < 0) return prev;
      const src = prev[idx];
      const copy: LabSlide = {
        ...src,
        id: crypto.randomUUID(),
        fields: src.fields ? { ...src.fields } : undefined,
        images: src.images
          ? Object.fromEntries(
              Object.entries(src.images).map(([k, v]) => [k, { ...v }]),
            )
          : undefined,
      };
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
        revokeCustomSlideImages(removed);
      }
      const next = prev.filter((s) => s.id !== id);
      if (selectedId === id) setSelectedId(next[0]?.id ?? null);
      return next;
    });
  };

  const requestDeleteSlide = (id: string) => {
    if (slides.length <= 1) return;
    setSlideDeleteId(id);
  };

  const confirmDeleteSlide = () => {
    if (!slideDeleteId) return;
    deleteSlide(slideDeleteId);
    setSlideDeleteId(null);
  };

  const reorderSlides = (dragId: string, insertIndex: number) => {
    setSlides((prev) => {
      const idx = prev.findIndex((s) => s.id === dragId);
      if (idx < 0) return prev;
      const next = [...prev];
      const [item] = next.splice(idx, 1);
      const clamped = Math.max(0, Math.min(next.length, insertIndex));
      next.splice(clamped, 0, item);
      return next;
    });
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
        setPhotoEditSlot(null);
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

  const closePhotoEdit = () => {
    setPhotoEditModalOpen(false);
    setPhotoEditSlot(null);
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
    setPhotoEditSlot(null);
    setPhotoEditModalOpen(true);
  };

  const openCustomPhotoEdit = (slot: string) => {
    if (!selectedSlide) return;
    const url = selectedSlide.images?.[slot]?.url;
    if (!url) return;
    const img = slideImagesRef.current.get(url);
    if (img) {
      setPhotoNaturalSize({
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
      });
    }
    setPhotoEditSlot(slot);
    setPhotoEditModalOpen(true);
  };

  const openPlateEdit = () => {
    const plate = bundledImagesRef.current.get(WDC_BG_FILE);
    if (plate) {
      setPhotoNaturalSize({
        width: plate.naturalWidth || plate.width,
        height: plate.naturalHeight || plate.height,
      });
    }
    setPhotoEditSlot("plate");
    setPhotoEditModalOpen(true);
  };

  const beginZipPhase = async (
    phase: ZipExportPhase,
    detail?: string,
    total = 1,
  ) => {
    zipProgressRef.current = { done: 0, total };
    setZipBusy(phase);
    setZipBusyDetail(detail);
    await yieldToUi();
  };

  const handleDownloadAllAssets = async () => {
    if (zipLockRef.current) return;
    const assets = buildRenderAssets();
    if (!assets) {
      setExportHint("Logo wird noch geladen …");
      return;
    }
    if (slides.length === 0) {
      setExportHint("Keine Slides im Deck.");
      return;
    }

    const rasterFormatKeys = enabledRasterFormats;
    const includePdf = exportFormatsEnabled.pdf;
    const includeGif = isWdc && exportGifEnabled;
    const includeMp4 = isWdc && exportMp4Enabled;
    if (rasterFormatKeys.length === 0 && !includePdf) {
      setExportHint("Mindestens ein Exportformat auswählen.");
      return;
    }
    if (rasterFormatKeys.length > 0 && enabledImageFormats.length === 0) {
      setExportHint("Mindestens PNG oder JPEG auswählen.");
      return;
    }

    const video = backgroundVideoRef.current;
    const motionSlides = slides.filter(
      (slide) => parseWdcPlateMode(slide.plateMode) === "animated",
    );
    const needMotion =
      isWdc && (includeGif || includeMp4) && motionSlides.length > 0;
    if (needMotion && !video) {
      setExportHint(
        "Videoplatte fehlt. Lege public/wdc-bg.mp4 (oder .webm / .mov) ab.",
      );
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

    const motionFormatKeys: Exclude<LabFormatKey, "pdf">[] =
      rasterFormatKeys.length > 0
        ? rasterFormatKeys
        : includeGif || includeMp4
          ? ["linkedin"]
          : [];

    setExportHint(null);
    zipLockRef.current = true;
    const zip = new JSZip();
    const downloadDate = new Date();
    const offscreen = document.createElement("canvas");

    const imageArchiveEntries: {
      formatKey: LabFormatKey;
      label: string;
      imageFormat: ExportImageFormat;
      filename: string;
    }[] = [];
    const motionArchiveEntries: {
      kind: "gif" | "mp4";
      formatKey: LabFormatKey;
      filename: string;
    }[] = [];

    try {
      const imageJobs =
        rasterFormatKeys.length * slides.length * enabledImageFormats.length;
      if (imageJobs > 0) {
        await beginZipPhase("images", undefined, imageJobs);
        let imageDone = 0;
        for (const formatKey of rasterFormatKeys) {
          const cfg = FORMAT_CONFIG[formatKey];
          setZipBusyDetail(FORMAT_SHORT_LABEL[formatKey]);
          for (const [i, slide] of slides.entries()) {
            renderLabSlide(offscreen, slide, formatKey, {
              ...assets,
              hdrHeadline: false,
            });
            const slideSuffix = slides.length > 1 ? `_slide-${i + 1}` : "";
            for (const imageFormat of enabledImageFormats) {
              const dataUrl = canvasToExportDataUrl(offscreen, imageFormat);
              const base64 = dataUrl.split(",")[1];
              const name = `${exportAssetBasename(title, `${cfg.exportSlug}${slideSuffix}`, downloadDate)}.${EXPORT_IMAGE_EXT[imageFormat]}`;
              imageArchiveEntries.push({
                formatKey,
                label: cfg.label,
                imageFormat,
                filename: name,
              });
              zip.file(name, base64, { base64: true });
              imageDone += 1;
              zipProgressRef.current = { done: imageDone, total: imageJobs };
            }
          }
          await yieldToUi();
        }
      }

      let pdfFilename: string | null = null;
      if (includePdf) {
        await beginZipPhase("pdf", undefined, slides.length);
        const pdf = new jsPDF({
          unit: "px",
          format: [1080, 1080],
          compress: true,
        });
        slides.forEach((slide, i) => {
          renderLabSlide(offscreen, slide, "pdf", {
            ...assets,
            hdrHeadline: false,
          });
          const dataUrl = canvasToExportDataUrl(offscreen, "png");
          if (i > 0) pdf.addPage([1080, 1080], "p");
          pdf.addImage(dataUrl, "PNG", 0, 0, 1080, 1080);
          zipProgressRef.current = { done: i + 1, total: slides.length };
        });

        pdfFilename = `${exportAssetBasename(title, "VDID-Lab-Deck", downloadDate)}.pdf`;
        zip.file(pdfFilename, pdf.output("blob"));
      }

      if (needMotion && video) {
        const motionAssets = {
          ...assets,
          backgroundVideo: video,
          hdrHeadline: false,
        };
        for (const formatKey of motionFormatKeys) {
          const cfg = FORMAT_CONFIG[formatKey];
          const short = FORMAT_SHORT_LABEL[formatKey];
          for (const [i, slide] of slides.entries()) {
            if (parseWdcPlateMode(slide.plateMode) !== "animated") continue;
            const slideSuffix = slides.length > 1 ? `_slide-${i + 1}` : "";
            const drawFrame = (ctx: CanvasRenderingContext2D) => {
              renderLabSlideToContext(
                ctx,
                slide,
                {
                  width: cfg.width,
                  height: cfg.height,
                  topUiSafeInsetRatio: cfg.topUiSafeInsetRatio,
                },
                motionAssets,
              );
            };
            const onProgress = (done: number, total: number) => {
              zipProgressRef.current = { done, total };
            };
            if (includeGif) {
              await beginZipPhase("gif", short);
              const blob = await encodeSlideGif({
                width: cfg.width,
                height: cfg.height,
                video,
                drawFrame,
                onProgress,
              });
              const name = `${exportAssetBasename(title, `${cfg.exportSlug}${slideSuffix}-motion`, downloadDate)}.gif`;
              zip.file(name, blob);
              motionArchiveEntries.push({
                kind: "gif",
                formatKey,
                filename: name,
              });
            }
            if (includeMp4) {
              await beginZipPhase("video", short);
              const blob = await encodeSlideVideo({
                width: cfg.width,
                height: cfg.height,
                video,
                drawFrame,
                onProgress,
              });
              const name = `${exportAssetBasename(title, `${cfg.exportSlug}${slideSuffix}-motion`, downloadDate)}.mp4`;
              zip.file(name, blob);
              motionArchiveEntries.push({
                kind: "mp4",
                formatKey,
                filename: name,
              });
            }
          }
        }
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
          images: imageArchiveEntries.map((e) => ({
            formatKey: e.formatKey,
            label: e.label,
            imageFormat: e.imageFormat,
            filename: e.filename,
          })),
          motion: motionArchiveEntries.map((e) => ({
            kind: e.kind,
            formatKey: e.formatKey,
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

      await beginZipPhase("zip", undefined, 100);
      const blob = await zip.generateAsync({ type: "blob" }, (meta) => {
        zipProgressRef.current = {
          done: Math.round(meta.percent),
          total: 100,
        };
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = zipDownloadFilename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportHint(
        err instanceof Error ? err.message : "ZIP-Export fehlgeschlagen.",
      );
    } finally {
      zipProgressRef.current = { done: 1, total: 1 };
      zipLockRef.current = false;
      setZipBusy(null);
      setZipBusyDetail(undefined);
    }
  };

  const handleZipButtonClick = () => {
    if (zipLockRef.current) return;
    if (enabledExportFormats.length === 0) {
      setExportHint("Mindestens ein Exportformat auswählen.");
      return;
    }
    if (enabledRasterFormats.length > 0 && enabledImageFormats.length === 0) {
      setExportHint("Mindestens PNG oder JPEG auswählen.");
      return;
    }
    if (isWdc && (exportGifEnabled || exportMp4Enabled) && !videoReady) {
      setExportHint(
        "Videoplatte fehlt. Lege public/wdc-bg.mp4 (oder .webm / .mov) ab.",
      );
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
    const assets = buildRenderAssets();
    if (!slide || !assets || !logoLoaded) return;

    const canvas = document.createElement("canvas");
    renderLabSlide(canvas, slide, previewFormat, assets);
    setLightboxUrl(canvas.toDataURL("image/png"));
  };

  const selectSlideFromPreview = (slideId: string) => {
    setSelectedId(slideId);
    postFormRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  const isCustomSlide = selectedSlide?.type === "custom";
  const templateCatalog = isWdc ? WDC_TEMPLATES : customTemplates;
  const selectedCustomTemplate =
    isCustomSlide && selectedSlide?.customTemplateId
      ? templateCatalog.find((t) => t.id === selectedSlide.customTemplateId)
      : null;

  const showFormatLabel =
    !isCustomSlide &&
    (selectedSlide?.type === "title" ||
      selectedSlide?.type === "eventPhoto" ||
      selectedSlide?.type === "coBranded" ||
      selectedSlide?.type === "freeform");
  const showHeading = !isCustomSlide && selectedSlide?.type !== "fullImage";
  const showImage =
    !isCustomSlide &&
    (selectedSlide?.type === "eventPhoto" ||
      selectedSlide?.type === "fullImage" ||
      selectedSlide?.type === "coBranded" ||
      selectedSlide?.type === "freeform");
  const showPartnerLogo = !isCustomSlide && selectedSlide?.type === "coBranded";
  const showDateLine =
    !isCustomSlide &&
    (selectedSlide?.type === "title" ||
      selectedSlide?.type === "eventPhoto" ||
      selectedSlide?.type === "coBranded");
  const showNameRole = !isCustomSlide && selectedSlide?.type === "quote";
  const showPresenter =
    !isCustomSlide &&
    (selectedSlide?.type === "eventPhoto" || selectedSlide?.type === "freeform");
  const showContact = !isCustomSlide && selectedSlide?.type === "cta";

  const editorAspect =
    FORMAT_CONFIG[previewFormat].width / FORMAT_CONFIG[previewFormat].height;
  const editorRenderAssets = buildRenderAssets();

  const slidePendingDelete = slides.find((s) => s.id === slideDeleteId);
  const slidePendingDeleteIndex =
    slideDeleteId != null
      ? slides.findIndex((s) => s.id === slideDeleteId) + 1
      : 0;
  const slideDeleteDescription = slidePendingDelete
    ? `Slide ${slidePendingDeleteIndex}${
        slidePendingDelete.type === "custom" && slidePendingDelete.fields
          ? (() => {
              const t = Object.values(slidePendingDelete.fields).find((v) => v.trim());
              return t ? ` („${stripMarkdown(t).slice(0, 60)}“)` : "";
            })()
          : slidePendingDelete.heading?.trim()
            ? ` („${stripMarkdown(slidePendingDelete.heading).slice(0, 60)}“)`
            : ""
      } wird unwiderruflich entfernt.`
    : "";

  const editingPlate = photoEditSlot === "plate";
  const editingCustomSlot =
    photoEditSlot && photoEditSlot !== "plate" ? photoEditSlot : null;
  const editingImageUrl = editingPlate
    ? publicFile(WDC_BG_FILE)
    : editingCustomSlot
      ? selectedSlide?.images?.[editingCustomSlot]?.url ?? null
      : selectedSlide?.imageUrl ?? null;
  const editingDefaultSettings = editingCustomSlot
    ? imageSlotDefaultEdits(selectedCustomTemplate, editingCustomSlot)
    : DEFAULT_IMAGE_EDIT_SETTINGS;
  const editingSettings = editingPlate
    ? selectedSlide?.imageEdits ?? DEFAULT_IMAGE_EDIT_SETTINGS
    : editingCustomSlot
      ? selectedSlide?.images?.[editingCustomSlot]?.edits ??
        editingDefaultSettings
      : selectedSlide?.imageEdits ?? DEFAULT_IMAGE_EDIT_SETTINGS;

  return (
    <>
      <div className="space-y-6">
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Vorschau</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              {!isWdc && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setTemplateEditorOpen(true)}
              >
                Vorlagen bearbeiten
              </Button>
              )}
              {isWdc && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={openPlateEdit}
              >
                Hintergrund bearbeiten…
              </Button>
              )}
            {previewFormatOptions.length > 0 && (
              <Tabs
                value={previewFormat}
                onValueChange={(value) =>
                  setPreviewFormat(value as LabFormatKey)
                }
              >
                <TabsList>
                  {previewFormatOptions.map((key) => (
                    <TabsTrigger key={key} value={key}>
                      {PREVIEW_FORMAT_TAB_LABELS[key]}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
              <LabSlidePreviewStrip
                slides={slides}
                selectedId={selectedSlide?.id ?? null}
                previewFormat={FORMAT_CONFIG[previewFormat]}
                logoRef={logoRef}
                logoWhiteRef={logoWhiteRef}
                slideImagesRef={slideImagesRef}
                partnerLogosRef={partnerLogosRef}
                customTemplatesRef={customTemplatesRef}
                bundledImagesRef={bundledImagesRef}
                backgroundVideoRef={backgroundVideoRef}
                animateVideo={
                  isWdc &&
                  videoReady &&
                  parseWdcPlateMode(selectedSlide?.plateMode) === "animated"
                }
                canvasClassName={isWdc ? "bg-[#0A2CD9]" : undefined}
                frameClassName={isWdc ? "bg-[#0A2CD9]" : undefined}
                logoStyle={logoStyle}
                logoLoaded={logoLoaded}
                previewRevision={previewRevision}
                maxHeight={480}
                onAddSlide={() => addSlide()}
                onSlideClick={selectSlideFromPreview}
                onSlideZoom={openLightboxForSlide}
                onDeleteSlide={requestDeleteSlide}
              />
            </div>
            {!isWdc && (
            <div className="space-y-1">
              <Label htmlFor="logoStyle">Logo</Label>
              <select
                id="logoStyle"
                value={logoStyle}
                onChange={(e) =>
                  setLogoStyle(e.target.value as LabLogoStyle)
                }
                className="flex h-10 w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm text-slate-900 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="color">Farbig</option>
                <option value="bw">Schwarzweiß</option>
              </select>
              <p className="text-xs text-slate-500">
                Bei „Foto Vollbild“ wird automatisch die Variante mit dem besten
                Kontrast zum Hintergrund gewählt.
              </p>
            </div>
            )}
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
          <div ref={postFormRef}>
          <Card>
            <CardHeader className="flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Post</CardTitle>
              <PostSlideOrderBar
                slides={slides}
                selectedId={selectedSlide.id}
                onSelect={setSelectedId}
                onReorder={reorderSlides}
                onDuplicate={duplicateSlide}
                onDelete={requestDeleteSlide}
              />
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label>Vorlage</Label>
                <SlideTemplatePicker
                  value={selectedSlide.type}
                  customTemplateId={selectedSlide.customTemplateId}
                  customTemplates={templateCatalog}
                  renderAssets={editorRenderAssets}
                  hideBuiltins={isWdc}
                  customCaptions={isWdc ? WDC_TEMPLATE_CAPTIONS : undefined}
                  thumbnailAspectClass={isWdc ? "aspect-square" : "aspect-[4/5]"}
                  onChange={(type) =>
                    changeSlideType(selectedSlide.id, type)
                  }
                  onSelectCustom={(templateId) =>
                    changeCustomTemplate(selectedSlide.id, templateId)
                  }
                />
              </div>
              {isWdc && (
                <WdcPlateModePicker
                  value={selectedSlide.plateMode}
                  onChange={(plateMode: WdcPlateMode) =>
                    updateSlide(selectedSlide.id, { plateMode })
                  }
                />
              )}
              {isCustomSlide && selectedCustomTemplate && (
                <CustomTemplateFields
                  slide={selectedSlide}
                  template={selectedCustomTemplate}
                  onFieldChange={(field, value) =>
                    updateCustomField(selectedSlide.id, field, value)
                  }
                  onImageUpload={handleCustomImageUpload}
                  onImageClear={clearCustomImage}
                  onImageEdit={openCustomPhotoEdit}
                  onPartnerWhiteOverlay={(slot, enabled) => {
                    if (!selectedSlide) return;
                    const prev = selectedSlide.images?.[slot];
                    updateSlide(selectedSlide.id, {
                      images: {
                        ...(selectedSlide.images ?? {}),
                        [slot]: {
                          url: prev?.url ?? null,
                          edits: prev?.edits,
                          whiteOverlay: enabled,
                        },
                      },
                    });
                    bumpPreview();
                  }}
                />
              )}
                  {showFormatLabel && (
                    <div className="space-y-1 md:col-span-2">
                      <Label htmlFor="formatLabel">Formatzeile</Label>
                      <select
                        id="formatLabel"
                        value={
                          formatLineOtherMode ||
                          isFormatLineCustom(selectedSlide.formatLabel)
                            ? FORMAT_LINE_OTHER
                            : formatLinePresetValue(selectedSlide.formatLabel)
                        }
                        onChange={(e) => {
                          const choice = e.target.value;
                          if (choice === FORMAT_LINE_OTHER) {
                            setFormatLineOtherMode(true);
                            if (
                              !isFormatLineCustom(selectedSlide.formatLabel)
                            ) {
                              updateSlide(selectedSlide.id, {
                                formatLabel: "",
                              });
                            }
                          } else {
                            setFormatLineOtherMode(false);
                            updateSlide(selectedSlide.id, {
                              formatLabel: choice,
                            });
                          }
                        }}
                        className="flex h-10 w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm text-slate-900 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        {!selectedSlide.formatLabel?.trim() &&
                          !formatLineOtherMode && (
                          <option value="" disabled>
                            Format wählen…
                          </option>
                        )}
                        {FORMAT_LINE_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                        <option value={FORMAT_LINE_OTHER}>Andere</option>
                      </select>
                      {(formatLineOtherMode ||
                        isFormatLineCustom(selectedSlide.formatLabel)) && (
                        <Input
                          id="formatLabel-custom"
                          value={selectedSlide.formatLabel ?? ""}
                          onChange={(e) =>
                            updateSlide(selectedSlide.id, {
                              formatLabel: e.target.value,
                            })
                          }
                          placeholder="Eigene Formatzeile eingeben …"
                          className="max-w-md"
                        />
                      )}
                    </div>
                  )}
                  {showHeading && (
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
                  )}
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
                        onKeyDown={(e) =>
                          onCanvasTextareaKeyDown(
                            e,
                            selectedSlide.body ?? "",
                            (body) => updateSlide(selectedSlide.id, { body }),
                          )
                        }
                        placeholder="Text mit Markdown — z. B. *kursiv* oder **hervorgehoben**"
                        rows={4}
                        className="resize-y"
                      />
                      <p className="text-xs text-slate-500">{MARKDOWN_FORMAT_HINT}</p>
                      <p className="text-xs text-slate-500">{CANVAS_BREAK_HINT}</p>
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
                  {!isCustomSlide && !showImage && !showPartnerLogo && (
                    <p className="text-xs text-slate-500 md:col-span-2">
                      Foto-Upload ist bei den Vorlagen{" "}
                      <strong>Event mit Foto</strong>, <strong>Foto Vollbild</strong>,{" "}
                      <strong>Co-Branding</strong> und <strong>Freitext</strong> verfügbar.
                    </p>
                  )}
                  {showImage && (
                    <SlideImageUploadField
                      id="slidePhoto"
                      label="Foto"
                      hint={
                        selectedSlide.type === "fullImage"
                          ? "Wird als Vollflächen-Hintergrund genutzt; VDID-Logo unten links."
                          : "Wird im Bildbereich der Slide angezeigt."
                      }
                      imageUrl={selectedSlide.imageUrl}
                      onUpload={(file) => handleImageUpload(file, "imageUrl")}
                      onClear={() => clearSlideImage("imageUrl")}
                      onEdit={openPhotoEdit}
                    />
                  )}
                  {showPartnerLogo && (
                    <div className="space-y-2 md:col-span-2">
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
                      {selectedSlide.partnerLogoUrl && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id="partner-logo-white"
                              checked={!!selectedSlide.partnerLogoWhiteOverlay}
                              onChange={(e) =>
                                updateSlide(selectedSlide.id, {
                                  partnerLogoWhiteOverlay: e.target.checked,
                                })
                              }
                            />
                            <Label
                              htmlFor="partner-logo-white"
                              className="cursor-pointer"
                            >
                              Mit Weiß überlagern
                            </Label>
                          </div>
                          <p className="text-xs text-slate-500">
                            Nimmt den Alpha-Kanal der PNG und färbt das Logo
                            weiß — lesbar auf dunklem Grund.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
            </CardContent>
          </Card>
          </div>
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
              {isWdc
                ? "Alles oben Gewählte als ZIP — Formate, Captions und angehakte Animationen."
                : "Bilder, Captions (.txt), PDF und Manifest als ZIP."}
            </p>
            {(enabledRasterFormats.length > 0 || isWdc) && (
              <div className="flex flex-wrap items-start gap-x-10 gap-y-4">
                {enabledRasterFormats.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-slate-500">
                      Bilddateiformat
                    </p>
                    <div className="flex flex-wrap gap-4">
                      {EXPORT_IMAGE_FORMATS.map((imageFormat) => (
                        <label
                          key={imageFormat}
                          htmlFor={`lab-image-format-${imageFormat}`}
                          className="flex cursor-pointer items-center gap-2 text-sm text-slate-700"
                        >
                          <Checkbox
                            id={`lab-image-format-${imageFormat}`}
                            checked={exportImageFormatsEnabled[imageFormat]}
                            onChange={(e) =>
                              toggleExportImageFormat(
                                imageFormat,
                                e.target.checked,
                              )
                            }
                          />
                          {EXPORT_IMAGE_FORMAT_LABELS[imageFormat]}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                {isWdc && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-slate-500">
                      Animation
                    </p>
                    <div className="flex flex-wrap gap-4">
                      <label
                        htmlFor="export-addition-gif"
                        className="flex cursor-pointer items-center gap-2 text-sm text-slate-700"
                      >
                        <Checkbox
                          id="export-addition-gif"
                          checked={exportGifEnabled}
                          disabled={!videoReady}
                          onChange={(e) => setExportGifEnabled(e.target.checked)}
                        />
                        GIF
                      </label>
                      <label
                        htmlFor="export-addition-mp4"
                        className="flex cursor-pointer items-center gap-2 text-sm text-slate-700"
                      >
                        <Checkbox
                          id="export-addition-mp4"
                          checked={exportMp4Enabled}
                          disabled={!videoReady}
                          onChange={(e) => setExportMp4Enabled(e.target.checked)}
                        />
                        MP4
                      </label>
                    </div>
                    {!videoReady && (
                      <p className="text-xs text-slate-500">
                        GIF und MP4 brauchen eine Platte unter{" "}
                        <code>public/wdc-bg.mp4</code>, <code>.webm</code> oder{" "}
                        <code>.mov</code>.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <ExportProgressButton
                busy={zipBusy != null}
                busyLabel={
                  zipBusy
                    ? zipPhaseLabel(zipBusy, zipBusyDetail)
                    : "ZIP"
                }
                idleLabel="ZIP"
                idleExtra={
                  <>
                    {enabledExportFormats.length <
                      ALL_LAB_FORMAT_KEYS.length && (
                      <span className="font-normal opacity-80">
                        ({enabledExportFormats.length} Formate)
                      </span>
                    )}
                    {isWdc && exportGifEnabled && (
                      <span className="font-normal opacity-80">GIF</span>
                    )}
                    {isWdc && exportMp4Enabled && (
                      <span className="font-normal opacity-80">MP4</span>
                    )}
                  </>
                }
                percent={zipPercent}
                started={zipStarted}
                disabled={
                  !logoLoaded ||
                  enabledExportFormats.length === 0 ||
                  (enabledRasterFormats.length > 0 &&
                    enabledImageFormats.length === 0) ||
                  (isWdc &&
                    (exportGifEnabled || exportMp4Enabled) &&
                    !videoReady)
                }
                onClick={handleZipButtonClick}
              />
              <Button
                type="button"
                variant="outline"
                disabled={zipBusy != null}
                onClick={() => {
                  for (const slide of slidesRef.current) {
                    revokeBlobUrl(slide.imageUrl);
                    revokeBlobUrl(slide.partnerLogoUrl);
                    revokeCustomSlideImages(slide);
                  }
                  setSlides(
                    isWdc
                      ? [createCustomSlide(WDC_DEFAULT_TEMPLATE_ID, WDC_TEMPLATES)]
                      : [createSlide("eventPhoto")],
                  );
                  setCaptions(EMPTY_CAPTIONS);
                  setSelectedId(null);
                  setExportFormatsEnabled(allLabFormatsEnabled());
                  setExportImageFormatsEnabled(allExportImageFormatsEnabled());
                  setExportGifEnabled(false);
                  setExportMp4Enabled(false);
                  try {
                    localStorage.removeItem(deckStorageKey);
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

      <TemplateEditorModal
        open={!isWdc && templateEditorOpen}
        onClose={() => setTemplateEditorOpen(false)}
        templates={customTemplates}
        onTemplatesChange={setCustomTemplates}
        assets={
          editorRenderAssets ?? {
            logoStyle,
            logo: logoRef.current!,
            logoWhite: logoWhiteRef.current,
            slideImages: slideImagesRef.current,
            partnerLogos: partnerLogosRef.current,
          }
        }
        editorAspect={editorAspect}
      />

      <ImageEditModal
        open={photoEditModalOpen && !!editingImageUrl}
        onClose={closePhotoEdit}
        title={editingPlate ? "Hintergrund bearbeiten" : "Foto bearbeiten"}
        imageUrl={editingImageUrl}
        naturalSize={photoNaturalSize}
        settings={editingSettings}
        defaultSettings={editingDefaultSettings}
        onSettingsChange={(imageEdits) => {
          if (!selectedSlide) return;
          if (editingCustomSlot) {
            updateSlide(selectedSlide.id, {
              images: {
                ...(selectedSlide.images ?? {}),
                [editingCustomSlot]: {
                  ...(selectedSlide.images?.[editingCustomSlot] ?? {
                    url: null,
                  }),
                  edits: imageEdits,
                },
              },
            });
            return;
          }
          updateSlide(selectedSlide.id, { imageEdits });
        }}
        onFileSelected={
          editingPlate
            ? undefined
            : editingCustomSlot
              ? (file) =>
                  handleCustomImageUpload(editingCustomSlot, "image", file)
              : (file) => handleImageUpload(file, "imageUrl")
        }
        onClearImage={
          editingPlate
            ? undefined
            : editingCustomSlot
              ? () => {
                  clearCustomImage(editingCustomSlot, "image");
                  closePhotoEdit();
                }
              : () => clearSlideImage("imageUrl")
        }
        idPrefix={
          editingPlate
            ? "wdc-plate"
            : editingCustomSlot
              ? `custom-photo-${editingCustomSlot}`
              : "lab-photo"
        }
        uploadHint="PNG, JPG, WebP …"
      />

      <ConfirmDialog
        open={slideDeleteId != null}
        title="Slide löschen?"
        description={slideDeleteDescription}
        confirmLabel="Löschen"
        cancelLabel="Abbrechen"
        destructive
        onConfirm={confirmDeleteSlide}
        onCancel={() => setSlideDeleteId(null)}
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

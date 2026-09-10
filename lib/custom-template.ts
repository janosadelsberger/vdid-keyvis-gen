import type { ImageEditSettings } from "@/lib/image-edit";
import type { WdcPlateMode } from "@/lib/wdc-theme";
import {
  labLogoNormalizedBox,
  squareLogoElements,
} from "@/lib/lab-layout";

/** Normalized box (0–1 fractions of canvas width/height). */
export type NormalizedBox = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type TextElementStyle = {
  heightFraction: number;
  fontWeight: string;
  baseColor: string;
  highlightColor: string;
  align: "left" | "right";
  lineHeightRatio: number;
  autoFit: boolean;
};

export type TextTemplateElement = {
  id: string;
  kind: "text";
  field: string;
  label: string;
  defaultText: string;
  style: TextElementStyle;
  box: NormalizedBox;
};

export type ImageTemplateElement = {
  id: string;
  kind: "image";
  slot: string;
  label: string;
  box: NormalizedBox;
  defaultEdits?: ImageEditSettings;
};

export type OverlayFit = "cover" | "contain" | "stretch";

export type TemplateOverlayAsset = {
  src: string;
  box: NormalizedBox;
  fit?: OverlayFit;
  backgroundFill?: string;
};

export type LogoTemplateElement = {
  id: string;
  kind: "logo";
  variant: "auto" | "dark" | "white";
  box: NormalizedBox;
};

export type PartnerLogoTemplateElement = {
  id: string;
  kind: "partnerLogo";
  slot: string;
  label: string;
  box: NormalizedBox;
};

export type RectTemplateElement = {
  id: string;
  kind: "rect";
  fill: string;
  radiusFraction: number;
  opacity: number;
  box: NormalizedBox;
};

export type LineTemplateElement = {
  id: string;
  kind: "line";
  color: string;
  thicknessFraction: number;
  box: NormalizedBox;
};

export type TemplateElement =
  | TextTemplateElement
  | ImageTemplateElement
  | LogoTemplateElement
  | PartnerLogoTemplateElement
  | RectTemplateElement
  | LineTemplateElement;

export type CustomTemplate = {
  id: string;
  name: string;
  /** width / height of the aspect used when designing */
  baseAspect: number;
  backgroundColor: string;
  /** Public-file path for a cover-drawn still plate (e.g. `/wdc-bg.png`). */
  backgroundImageSrc?: string;
  /** Template-level chrome images drawn after the plate, before elements. */
  overlayAssets?: TemplateOverlayAsset[];
  elements: TemplateElement[];
  /** Editor-only alignment guides (normalized 0–1). Not rendered on export. */
  guides?: TemplateGuides;
};

export type TemplateGuides = {
  /** Vertical guide x positions (0–1). */
  vertical: number[];
  /** Horizontal guide y positions (0–1). */
  horizontal: number[];
};

export const EMPTY_TEMPLATE_GUIDES: TemplateGuides = {
  vertical: [],
  horizontal: [],
};

export function normalizeGuides(raw: unknown): TemplateGuides {
  if (typeof raw !== "object" || raw === null) return { ...EMPTY_TEMPLATE_GUIDES };
  const o = raw as Partial<TemplateGuides>;
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  const dedupe = (values: number[]) =>
    [...new Set(values.map((v) => Math.round(v * 10000) / 10000))].sort(
      (a, b) => a - b,
    );
  const nums = (arr: unknown) =>
    Array.isArray(arr)
      ? arr.filter((v): v is number => typeof v === "number" && Number.isFinite(v)).map(clamp)
      : [];
  return {
    vertical: dedupe(nums(o.vertical)),
    horizontal: dedupe(nums(o.horizontal)),
  };
}

export function getTemplateGuides(template: CustomTemplate): TemplateGuides {
  return normalizeGuides(template.guides);
}

export type CustomSlideImageSlot = {
  url: string | null;
  edits?: ImageEditSettings;
  /** Paint the PNG alpha as white so the mark reads on a dark plate. */
  whiteOverlay?: boolean;
};

export type CustomSlideContent = {
  fields: Record<string, string>;
  images: Record<string, CustomSlideImageSlot>;
  plateEdits?: ImageEditSettings;
  plateMode?: WdcPlateMode;
};

export const CUSTOM_TEMPLATES_STORAGE_KEY = "vdid-lab-custom-templates-v1";

const DEFAULT_TEXT_STYLE: TextElementStyle = {
  heightFraction: 0.04,
  fontWeight: "400",
  baseColor: "#1A1A1A",
  highlightColor: "#0A2CD9",
  align: "left",
  lineHeightRatio: 1.25,
  autoFit: true,
};

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function normalizeBox(box: Partial<NormalizedBox> | undefined): NormalizedBox {
  const x = clamp01(box?.x ?? 0);
  const y = clamp01(box?.y ?? 0);
  const w = Math.max(0.02, Math.min(1 - x, box?.w ?? 0.2));
  const h = Math.max(0.02, Math.min(1 - y, box?.h ?? 0.1));
  return { x, y, w, h };
}

function slugFieldId(label: string, existing: Set<string>): string {
  const base =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "") || "field";
  let id = base;
  let n = 2;
  while (existing.has(id)) {
    id = `${base}_${n++}`;
  }
  existing.add(id);
  return id;
}

export function createElementId(): string {
  return crypto.randomUUID();
}

export function createDefaultTemplate(name = "Neue Vorlage"): CustomTemplate {
  return {
    id: crypto.randomUUID(),
    name,
    baseAspect: 1080 / 1350,
    backgroundColor: "#F0F0F0",
    elements: [
      {
        id: createElementId(),
        kind: "text",
        field: "heading",
        label: "Titel",
        defaultText: "Titel",
        style: { ...DEFAULT_TEXT_STYLE, fontWeight: "700", heightFraction: 0.065 },
        box: { x: 0.08, y: 0.1, w: 0.84, h: 0.2 },
      },
      {
        id: createElementId(),
        kind: "logo",
        variant: "dark",
        box: labLogoNormalizedBox(1080 / 1350),
      },
    ],
  };
}

export function cloneTemplate(template: CustomTemplate, name?: string): CustomTemplate {
  const fieldIds = new Set<string>();
  return {
    ...template,
    id: crypto.randomUUID(),
    name: name ?? `${template.name} (Kopie)`,
    elements: template.elements.map((el) => {
      const id = createElementId();
      if (el.kind === "text") {
        const field = slugFieldId(el.field || el.label, fieldIds);
        return { ...el, id, field, style: { ...el.style } };
      }
      if (el.kind === "image" || el.kind === "partnerLogo") {
        const slot = slugFieldId(el.slot || el.label, fieldIds);
        return { ...el, id, slot };
      }
      return { ...el, id, box: { ...el.box } };
    }),
  };
}

function parseDefaultEdits(raw: unknown): ImageEditSettings | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const o = raw as Partial<ImageEditSettings>;
  const focal = o.focalPoint;
  return {
    focalPoint:
      focal && typeof focal.x === "number" && typeof focal.y === "number"
        ? { x: clamp01(focal.x), y: clamp01(focal.y) }
        : { x: 0.5, y: 0.5 },
    overlayEnabled: o.overlayEnabled === true,
    overlayOpacity: typeof o.overlayOpacity === "number" ? o.overlayOpacity : 0.35,
    grayscaleEnabled: o.grayscaleEnabled === true,
    blueTintEnabled: o.blueTintEnabled === true,
    blueTintOpacity:
      typeof o.blueTintOpacity === "number" ? o.blueTintOpacity : 0.22,
  };
}

function parseOverlayAsset(raw: unknown): TemplateOverlayAsset | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Partial<TemplateOverlayAsset>;
  if (typeof o.src !== "string" || !o.src) return null;
  const fit =
    o.fit === "cover" || o.fit === "contain" || o.fit === "stretch"
      ? o.fit
      : "contain";
  return {
    src: o.src,
    box: normalizeBox(o.box),
    fit,
    backgroundFill:
      typeof o.backgroundFill === "string" ? o.backgroundFill : undefined,
  };
}

function parseOverlayAssets(raw: unknown): TemplateOverlayAsset[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const assets = raw
    .map(parseOverlayAsset)
    .filter((a): a is TemplateOverlayAsset => a != null);
  return assets.length > 0 ? assets : undefined;
}

export function collectTemplateAssetSrcs(template: CustomTemplate): string[] {
  const srcs: string[] = [];
  if (template.backgroundImageSrc) srcs.push(template.backgroundImageSrc);
  for (const overlay of template.overlayAssets ?? []) {
    srcs.push(overlay.src);
  }
  return srcs;
}

function parseTextStyle(raw: unknown): TextElementStyle {
  const o = raw as Partial<TextElementStyle>;
  return {
    heightFraction:
      typeof o.heightFraction === "number" ? o.heightFraction : DEFAULT_TEXT_STYLE.heightFraction,
    fontWeight: typeof o.fontWeight === "string" ? o.fontWeight : DEFAULT_TEXT_STYLE.fontWeight,
    baseColor: typeof o.baseColor === "string" ? o.baseColor : DEFAULT_TEXT_STYLE.baseColor,
    highlightColor:
      typeof o.highlightColor === "string"
        ? o.highlightColor
        : DEFAULT_TEXT_STYLE.highlightColor,
    align: o.align === "right" ? "right" : "left",
    lineHeightRatio:
      typeof o.lineHeightRatio === "number"
        ? o.lineHeightRatio
        : DEFAULT_TEXT_STYLE.lineHeightRatio,
    autoFit: o.autoFit !== false,
  };
}

function parseElement(raw: unknown): TemplateElement | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id : createElementId();
  const kind = o.kind;
  const box = normalizeBox(o.box as Partial<NormalizedBox>);

  switch (kind) {
    case "text":
      return {
        id,
        kind: "text",
        field: typeof o.field === "string" ? o.field : "text",
        label: typeof o.label === "string" ? o.label : "Text",
        defaultText: typeof o.defaultText === "string" ? o.defaultText : "",
        style: parseTextStyle(o.style),
        box,
      };
    case "image":
      return {
        id,
        kind: "image",
        slot: typeof o.slot === "string" ? o.slot : "image",
        label: typeof o.label === "string" ? o.label : "Foto",
        box,
        defaultEdits: parseDefaultEdits(o.defaultEdits),
      };
    case "logo":
      return {
        id,
        kind: "logo",
        variant:
          o.variant === "dark" || o.variant === "white" || o.variant === "auto"
            ? o.variant
            : "dark",
        box,
      };
    case "partnerLogo":
      return {
        id,
        kind: "partnerLogo",
        slot: typeof o.slot === "string" ? o.slot : "partner",
        label: typeof o.label === "string" ? o.label : "Partner-Logo",
        box,
      };
    case "rect":
      return {
        id,
        kind: "rect",
        fill: typeof o.fill === "string" ? o.fill : "#F0F0F0",
        radiusFraction: typeof o.radiusFraction === "number" ? o.radiusFraction : 0,
        opacity: typeof o.opacity === "number" ? o.opacity : 1,
        box,
      };
    case "line":
      return {
        id,
        kind: "line",
        color: typeof o.color === "string" ? o.color : "#1A1A1A",
        thicknessFraction:
          typeof o.thicknessFraction === "number" ? o.thicknessFraction : 0.002,
        box,
      };
    default:
      return null;
  }
}

export function parseCustomTemplate(raw: unknown): CustomTemplate | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.name !== "string") return null;
  const elements = Array.isArray(o.elements)
    ? o.elements.map(parseElement).filter((e): e is TemplateElement => e != null)
    : [];
  const baseAspect = typeof o.baseAspect === "number" ? o.baseAspect : 1080 / 1350;
  return {
    id: o.id,
    name: o.name,
    baseAspect,
    backgroundColor:
      typeof o.backgroundColor === "string" ? o.backgroundColor : "#F0F0F0",
    backgroundImageSrc:
      typeof o.backgroundImageSrc === "string" ? o.backgroundImageSrc : undefined,
    overlayAssets: parseOverlayAssets(o.overlayAssets),
    elements: squareLogoElements(elements, baseAspect),
    guides: normalizeGuides(o.guides),
  };
}

export function parseCustomTemplates(raw: string): CustomTemplate[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.map(parseCustomTemplate).filter((t): t is CustomTemplate => t != null);
    }
    if (typeof parsed === "object" && parsed !== null && Array.isArray((parsed as { templates?: unknown }).templates)) {
      return ((parsed as { templates: unknown[] }).templates)
        .map(parseCustomTemplate)
        .filter((t): t is CustomTemplate => t != null);
    }
    return [];
  } catch {
    return [];
  }
}

export function serializeCustomTemplates(templates: CustomTemplate[]): string {
  return JSON.stringify(templates, null, 2);
}

export function loadCustomTemplatesFromStorage(): CustomTemplate[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CUSTOM_TEMPLATES_STORAGE_KEY);
    if (!raw) return [];
    return parseCustomTemplates(raw);
  } catch {
    return [];
  }
}

export function saveCustomTemplatesToStorage(templates: CustomTemplate[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CUSTOM_TEMPLATES_STORAGE_KEY, serializeCustomTemplates(templates));
  } catch {
    /* quota */
  }
}

export function exportTemplatesJson(templates: CustomTemplate[]): void {
  const blob = new Blob([serializeCustomTemplates(templates)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "vdid-custom-templates.json";
  a.click();
  URL.revokeObjectURL(url);
}

export async function importTemplatesJsonFile(
  file: File,
): Promise<CustomTemplate[]> {
  const text = await file.text();
  return parseCustomTemplates(text);
}

export function defaultContentForTemplate(template: CustomTemplate): CustomSlideContent {
  const fields: Record<string, string> = {};
  const images: Record<string, CustomSlideImageSlot> = {};
  for (const el of template.elements) {
    if (el.kind === "text") {
      fields[el.field] = el.defaultText;
    }
    if (el.kind === "image" || el.kind === "partnerLogo") {
      images[el.slot] = {
        url: null,
        ...(el.kind === "image" && el.defaultEdits
          ? { edits: el.defaultEdits }
          : {}),
      };
    }
  }
  return { fields, images };
}

export function createDefaultElement(
  kind: TemplateElement["kind"],
  baseAspect = 1080 / 1350,
): TemplateElement {
  const id = createElementId();
  switch (kind) {
    case "text":
      return {
        id,
        kind: "text",
        field: "text",
        label: "Text",
        defaultText: "Text",
        style: { ...DEFAULT_TEXT_STYLE },
        box: { x: 0.08, y: 0.2, w: 0.84, h: 0.12 },
      };
    case "image":
      return {
        id,
        kind: "image",
        slot: "photo",
        label: "Foto",
        box: { x: 0.08, y: 0.35, w: 0.84, h: 0.45 },
      };
    case "logo":
      return {
        id,
        kind: "logo",
        variant: "dark",
        box: labLogoNormalizedBox(baseAspect),
      };
    case "partnerLogo":
      return {
        id,
        kind: "partnerLogo",
        slot: "partner",
        label: "Partner-Logo",
        box: { x: 0.7, y: 0.82, w: 0.22, h: 0.1 },
      };
    case "rect":
      return {
        id,
        kind: "rect",
        fill: "#0A2CD9",
        radiusFraction: 0,
        opacity: 1,
        box: { x: 0, y: 0, w: 1, h: 1 },
      };
    case "line":
      return {
        id,
        kind: "line",
        color: "#1A1A1A",
        thicknessFraction: 0.002,
        box: { x: 0.08, y: 0.5, w: 0.84, h: 0.01 },
      };
  }
}

export const ELEMENT_KIND_LABELS: Record<TemplateElement["kind"], string> = {
  text: "Text",
  image: "Foto",
  logo: "VDID-Logo",
  partnerLogo: "Partner-Logo",
  rect: "Fläche",
  line: "Linie",
};

export function boxToPixels(
  box: NormalizedBox,
  width: number,
  height: number,
): { x: number; y: number; w: number; h: number } {
  return {
    x: box.x * width,
    y: box.y * height,
    w: box.w * width,
    h: box.h * height,
  };
}

export function pixelsToBox(
  px: { x: number; y: number; w: number; h: number },
  width: number,
  height: number,
): NormalizedBox {
  const toNorm = (v: number, size: number) =>
    Math.min(1, Math.max(0, v / size));
  return {
    x: toNorm(px.x, width),
    y: toNorm(px.y, height),
    w: toNorm(px.w, width),
    h: toNorm(px.h, height),
  };
}

/** Editor preview width; height follows template baseAspect. */
export const TEMPLATE_EDITOR_WIDTH_PX = 540;

export function editorCanvasSizePx(baseAspect: number): {
  width: number;
  height: number;
} {
  const width = TEMPLATE_EDITOR_WIDTH_PX;
  const height = Math.round(width / baseAspect);
  return { width, height };
}

/** Text field IDs used in custom templates — map to generator slide.fields keys. */
export const TEMPLATE_TEXT_FIELD_OPTIONS = [
  {
    id: "formatLabel",
    label: "Formatzeile",
    elementLabel: "Formatzeile",
    defaultText: "VDID Fortbildung",
  },
  {
    id: "heading",
    label: "Titel / Überschrift",
    elementLabel: "Titel",
    defaultText: "VDID Event",
  },
  {
    id: "dateLine",
    label: "Datum / Ort",
    elementLabel: "Datum",
    defaultText: "01.01.2026 | 10:00",
  },
  {
    id: "body",
    label: "Fließtext",
    elementLabel: "Text",
    defaultText: "Text",
  },
  {
    id: "name",
    label: "Name",
    elementLabel: "Name",
    defaultText: "Name",
  },
  {
    id: "role",
    label: "Rolle / Funktion",
    elementLabel: "Rolle",
    defaultText: "Rolle",
  },
  {
    id: "contact",
    label: "Kontakt",
    elementLabel: "Kontakt",
    defaultText: "kontakt@vdid.de",
  },
] as const;

export const TEMPLATE_IMAGE_SLOT_OPTIONS = [
  { id: "photo", label: "Eventfoto", elementLabel: "Foto" },
  { id: "hero", label: "Vollflächiges Bild", elementLabel: "Bild" },
  { id: "partner", label: "Partner-Logo", elementLabel: "Partner-Logo" },
  { id: "partner2", label: "Partner-Logo 2", elementLabel: "Partner-Logo 2" },
  { id: "partner3", label: "Partner-Logo 3", elementLabel: "Partner-Logo 3" },
] as const;

const TEXT_FIELD_IDS = new Set(
  TEMPLATE_TEXT_FIELD_OPTIONS.map((o) => o.id),
);
const IMAGE_SLOT_IDS = new Set(
  TEMPLATE_IMAGE_SLOT_OPTIONS.map((o) => o.id),
);

export function isKnownTextFieldId(field: string): boolean {
  return TEXT_FIELD_IDS.has(field as (typeof TEMPLATE_TEXT_FIELD_OPTIONS)[number]["id"]);
}

export function isKnownImageSlotId(slot: string): boolean {
  return IMAGE_SLOT_IDS.has(slot as (typeof TEMPLATE_IMAGE_SLOT_OPTIONS)[number]["id"]);
}

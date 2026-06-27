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
import { exportAssetBasename } from "@/lib/export-naming";
import { cn } from "@/lib/utils";
import { ImageDropZone } from "@/components/image-drop-zone";
import { ImageEditModal } from "@/components/image-edit-modal";
import {
  DEFAULT_IMAGE_EDIT_SETTINGS,
  applyImageEditOverlays,
  drawBackgroundCover,
  type ImageEditSettings,
} from "@/lib/image-edit";

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

type BackgroundLoadState = "idle" | "loading" | "ready";

type FormatKey =
  | "websitePreview"
  | "websiteHeader"
  | "instagramGrid"
  | "instagramStory"
  | "linkedinSquare"
  | "linkedinEvent"
  | "eventbriteHeader"
  | "zoomBackground";

type FormatCanvasConfig = {
  label: string;
  width: number;
  height: number;
  includeMeta: boolean;
  /** Fraction of canvas height: extra top inset for platform UI (e.g. Instagram Story). */
  topUiSafeInsetRatio?: number;
};

const FORMAT_CONFIG: Record<FormatKey, FormatCanvasConfig> = {
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
    /** Safe zone below profile / close UI (~12–14% of 9:16). */
    topUiSafeInsetRatio: 0.13,
  },
  linkedinSquare: {
    label: "LinkedIn 1080×1080",
    width: 1080,
    height: 1080,
    includeMeta: true,
  },
  linkedinEvent: {
    label: "LinkedIn Event 1600×900",
    width: 1600,
    height: 900,
    includeMeta: true,
  },
  eventbriteHeader: {
    label: "Eventbrite Header 2160×1080",
    width: 2160,
    height: 1080,
    includeMeta: true,
  },
  zoomBackground: {
    label: "Zoom Background 1920×1080",
    width: 1920,
    height: 1080,
    includeMeta: false,
  },
};

/** Matches `viewBox` height in `public/VDID_Logo_neg.svg`. */
const VDID_LOGO_VIEWBOX_SIZE = 200;
/** White VDID mark square in SVG units (top-left of asset). */
const VDID_LOGO_MARK_SQUARE = 100;

/** Third segment of `yymmdd_title_<slug>.png` export filenames */
const FORMAT_EXPORT_SLUG: Record<FormatKey, string> = {
  websitePreview: "Website-Preview-800x800",
  websiteHeader: "Website-Header-1920x800",
  instagramGrid: "Instagram-Grid-1080x1350",
  instagramStory: "Instagram-Story-1080x1920",
  linkedinSquare: "LinkedIn-1080x1080",
  linkedinEvent: "LinkedIn-Event-1600x900",
  eventbriteHeader: "Eventbrite-Header-2160x1080",
  zoomBackground: "Zoom-Background-1920x1080",
};

const ALL_FORMAT_KEYS = Object.keys(FORMAT_CONFIG) as FormatKey[];

function allKeyvisualFormatsEnabled(): Record<FormatKey, boolean> {
  return Object.fromEntries(
    ALL_FORMAT_KEYS.map((k) => [k, true]),
  ) as Record<FormatKey, boolean>;
}

function RequiredMark() {
  return (
    <span className="text-red-600" aria-hidden>
      {" "}
      *
    </span>
  );
}

/** Research-oriented targets for reach / engagement — not platform hard caps. */
type CaptionTipsPlatform = "website" | "instagram" | "linkedin";

/**
 * Referenzlänge eines mehrabsätzigen Website-Begleittextes (VDID-Beispielkorpus,
 * inkl. Zeilenumbrüche zwischen Absätzen), **auf 1700 Zeichen gerundet** —
 * Soft-Limit im UI und im LLM-Prompt.
 */
const WEBSITE_REFERENCE_CONTEXT_CHAR_COUNT = 1700;

const CAPTION_SWEET_SPOT: Record<CaptionTipsPlatform, number> = {
  /** Ausführlicher Kontextblock orientiert am Referenzbeispiel (~1700 Zeichen); Snippets separat kürzer. */
  website: WEBSITE_REFERENCE_CONTEXT_CHAR_COUNT,
  /** Feed / carousel engagement band often cited ~300–500 chars; midpoint as guideline. */
  instagram: 400,
  /** Long-form LinkedIn posts: many benchmarks peak ~1200–1600 chars. */
  linkedin: 1400,
};

const CAPTION_PERFORMANCE_COPY: Record<
  CaptionTipsPlatform,
  { title: string; tips: string[] }
> = {
  website: {
    title: "Website",
    tips: [
      "Nutzen und Keyword natürlich an den Anfang; aktive Formulierung, klarer Mehrwert.",
      "Text und Suchintention zur Seite passend halten — kein Keyword-Stuffing.",
      "Handlungsaufforderung nur, wenn sie echten Mehrwert hat.",
      "Bei längeren Texten: ersten Satz so schreiben, dass er auch allein als Teaser funktioniert.",
      "Genug Kontext statt nackter Schlagworte — sonst schreibt Google den Snippet oft neu.",
    ],
  },
  instagram: {
    title: "Instagram",
    tips: [
      "Erste Zeile = Hook (Stop-Scrolling): Nutzen, Neugier oder klare Aussage.",
      "Hashtags ans Ende; wenige, passende — kein Spam-Block.",
      "Zeilenumbrüche und kurze Absätze für Lesbarkeit und Verweildauer.",
      "Keine Links in der Caption wenn möglich: Link in Bio, Sticker (Stories) oder ersten Kommentar (anpinnen).",
      "Frage oder klare Meinung für Kommentare — nicht nur Emojis ohne Inhalt.",
      "Ton zur Marke halten; Wiederholungen vermeiden.",
    ],
  },
  linkedin: {
    title: "LinkedIn",
    tips: [
      "Erste Zeilen = Hook: konkretes Problem, klare These oder greifbare Zahl.",
      "Struktur mit Absätzen und Leerzeilen; keine Romane — gut scannbar halten.",
      "Maximal wenige, sehr relevante Hashtags.",
      "Externe Links nicht im Fließtext: Link in den ersten Kommentar und im Post darauf hinweisen.",
      "Kommentare einladen (Frage oder kontroverse These — professionell).",
      "Native Medien (PDF, mehrere Bilder) nur wenn sie den Inhalt echt tragen.",
    ],
  },
};

/**
 * Kontext zum Verband für den kopierbaren LLM-Prompt (Captions).
 * Kurz gefasst: Rolle, Schwerpunkte, Tonalität — ohne Anspruch auf Vollständigkeit.
 */
const VDID_ORG_DESCRIPTION_FOR_LLM = `Der VDID — Verband der Industrie Designerinnen und Designer e. V. — ist der Berufsverband für Industrie- und Produktdesign in Deutschland. Er vertritt die beruflichen und fachpolitischen Interessen von Industrie-Designerinnen und -designern, stärkt den Austausch innerhalb der Community und mit Partnern aus Wirtschaft, Wissenschaft und Öffentlichkeit und macht die Rolle von Design für Innovation, Qualität und gesellschaftliche Entwicklung sichtbar.

Formate wie »Design.Wissen.Diskurs.« oder »Insight Update« sowie regionale und überregionale Events vernetzen die Szene und transportieren Designthemen in die Öffentlichkeit.

Für Begleittexte gilt: sachlich-präzise und zugänglich; professionell ohne Marketing-Pathos; die gestalterische Expertise der Community würdigen; inklusive und respektvolle Ansprache bevorzugen.`;

/**
 * Kein konkretes Event — beschreibt **Umfang, erzählerische Tiefe und Bausteine**
 * eines Website-Kontexts, die sich auf beliebige VDID-Themen übertragen lassen.
 */
const WEBSITE_LLM_CONTEXT_STRUCTURE_BLUEPRINT = `Es geht nicht um eine feste Veranstaltung, sondern um eine **übertragbare Vorlage**: Welche Länge und welcher Aufbau sind für einen narrativen Kontextblock zu Website-Begleittexten (CMS, Landingpage, Meta-Einbettung) sinnvoll — unabhängig von Datum, Stadt oder Formatname.

### Zielumfang
- Mehrere **kurze Absätze** statt einer einzelnen Zeile; ein nachvollziehbarer **Roter Faden**.
- **Zeichenorientierung:** ausführlicher Fließtext-Kontext etwa **${WEBSITE_REFERENCE_CONTEXT_CHAR_COUNT} Zeichen** (Referenz: VDID-Beispieltext mit Absatzumbrüchen). Liegt der Stoff darunter, ist das in Ordnung; liegt er klar darüber, Struktur und Redundanz prüfen. **Meta-Titel / SERP-Snippet** sind oft viel kürzer (~150–160 sichtbar) — ggf. als **separate**, gekürzte Variante planen, nicht als alleiniges Zeichenziel für den Haupttext.

### Bausteine (Reihenfolge nach Bedarf anpassen)
1. **Einstieg / Rahmen**: Was steht an — übergeordnete Initiative, Region, Jahr oder gesellschaftlicher bzw. fachlicher Bezug.
2. **Relevanz / Umfeld**: Warum es für die Zielgruppe zählt; Größenordnung von Programm, Partnern oder Reichweite — nur mit vom Nutzer gelieferten oder bestätigten Angaben.
3. **Rolle des VDID**: Konkrete Beteiligung (Format, Kooperation, inhaltlicher Schwerpunkt); ohne Übertreibung.
4. **Kernbotschaft / Zeitraum**: Dauer, Leitidee oder Programmtitel in einem prägnanten Satz.
5. **Ablauf** (falls sinnvoll): nach Tagen, Tracks oder Themenblöcken — knapp und scannbar.
6. **Ort & Zeit**: Veranstaltungsort(e), Datum oder -spanne, wenn relevant.
7. **Handlungsaufforderung**: z. B. Save-the-Date, Merken, Teilen — klar, nicht aufdringlich.
8. **Verweise**: offizielle Websites, Kalender, Registrierung — nur mit korrekten URLs aus Nutzerangaben.

### Arbeitsweise für das Modell
- **Keine erfundenen** Zahlen, Namen oder Zitate; fehlende Fakten beim Nutzer nachfragen oder als Lücke markieren.
- **Ton**: professionell, einladend, sachlich — zur VDID-Marke passend (siehe Kurzprofil oben).`;

/** Kurzer Kontext zur Soft-Limit-Zahl für den LLM-Prompt. */
const PLATFORM_LENGTH_GUIDANCE: Record<CaptionTipsPlatform, string> = {
  website: `Referenzumfang ausführlicher Website-Begleittexte ca. ${WEBSITE_REFERENCE_CONTEXT_CHAR_COUNT} Zeichen (VDID-Beispielkorpus, inkl. Absatzumbrüche). SERP/Meta-Snippets sind kurz (~150–160 sichtbar) — bei Bedarf zusätzlich kondensieren.`,
  instagram:
    "Typische Bandbreite für Feed und Karussell — oft genanntes Engagement-Fenster etwa 300–500 Zeichen; der Wert unten ist eine mittlere Orientierung.",
  linkedin:
    "Typische Bandbreite für längere Fachposts — viele Benchmarks für starkes Engagement bei etwa 1200–1600 Zeichen.",
};

function blankAsUnsetForPrompt(s: string): string {
  const t = s.trim();
  return t.length > 0 ? t : "*(nicht angegeben)*";
}

function captionDraftBlock(label: string, text: string): string {
  const t = text.trim();
  if (!t) return `**${label}**\n  *(noch leer)*`;
  const indented = text.split("\n").map((line) => `  ${line}`).join("\n");
  return `**${label}**\n${indented}`;
}

/** Alle Formularfelder für LLM-Prompts (Markdown). */
function formatEventFormForLlmPrompt(form: EventFormState): string {
  const eventFormat =
    form.eventFormat === "other"
      ? blankAsUnsetForPrompt(form.eventFormatCustom)
      : form.eventFormat === "–"
        ? "*(nicht gewählt)*"
        : form.eventFormat;

  return [
    `- **Eventformat:** ${eventFormat}`,
    `- **Titel (Grafik):** ${blankAsUnsetForPrompt(form.title)}`,
    `- **Unterzeile:** ${blankAsUnsetForPrompt(form.subtitle)}`,
    `- **Datum:** ${form.date ? format(form.date, "dd.MM.yyyy") : "*(nicht angegeben)*"}`,
    `- **Uhrzeit:** ${blankAsUnsetForPrompt(form.time)}`,
    `- **Online-Veranstaltung:** ${form.isOnline ? "Ja" : "Nein"}`,
    `- **Ort:** ${blankAsUnsetForPrompt(form.place)}`,
    `- **Copyright (Grafik):** ${blankAsUnsetForPrompt(form.copyright)}`,
    "",
    captionDraftBlock("Caption-Entwurf Website", form.captionWebsite),
    "",
    captionDraftBlock("Caption-Entwurf Instagram", form.captionInstagram),
    "",
    captionDraftBlock("Caption-Entwurf LinkedIn", form.captionLinkedIn),
  ].join("\n");
}

type BuildCaptionTipsLlmPromptOptions = {
  /** Standard: ja. Im Sammelprompt nur einmal oben, nicht in jedem Kanalblock wiederholen. */
  includeFormSnapshot?: boolean;
};

/**
 * Strukturierter Prompt für LLMs: VDID-Kurzprofil; bei Website zusätzlich
 * übertragbare Vorlage für Länge/Aufbau des Kontexts; Kanal, Länge, Checkliste.
 * Optional: aktuelle Generator-Eingaben als Faktengrundlage.
 */
function buildCaptionTipsLlmPrompt(
  platform: CaptionTipsPlatform,
  form: EventFormState,
  options?: BuildCaptionTipsLlmPromptOptions,
): string {
  const includeFormSnapshot = options?.includeFormSnapshot ?? true;
  const meta = CAPTION_PERFORMANCE_COPY[platform];
  const softChars = CAPTION_SWEET_SPOT[platform];
  const lengthNote = PLATFORM_LENGTH_GUIDANCE[platform];
  const checklist = meta.tips
    .map((tip, i) => `${i + 1}. ${tip}`)
    .join("\n");

  const sections: string[] = [
    "Du bist ein erfahrener Redakteur für Organisations- und Eventkommunikation.",
    "",
    "## Auftrag",
    "Formuliere, überarbeite oder bewerte Begleittexte (Captions) für Veröffentlichungen — angelehnt an die folgenden kanalspezifischen Qualitätskriterien.",
    "",
  ];

  if (includeFormSnapshot) {
    sections.push(
      "## Aktuelle Eingaben aus dem Keyvisual Generator",
      "Nutze diese Angaben als Faktengrundlage; Platzhalter bedeuten: Feld noch leer oder nicht gewählt.",
      "",
      formatEventFormForLlmPrompt(form),
      "",
    );
  }

  sections.push(
    "## Organisation und Marke — VDID",
    VDID_ORG_DESCRIPTION_FOR_LLM,
    "",
  );

  if (platform === "website") {
    sections.push(
      "## Substanz und Aufbau des narrativen Website-Kontexts (übertragbare Vorlage)",
      WEBSITE_LLM_CONTEXT_STRUCTURE_BLUEPRINT,
      "",
    );
  }

  sections.push(
    "## Zielkanal",
    meta.title,
    "",
    "## Orientierung zur Textlänge (weiche Richtzahl, keine harte Obergrenze)",
    `- Zielorientierung: etwa ${softChars} Zeichen.`,
    `- Einordnung: ${lengthNote}`,
    "",
    "## Checkliste — Hinweise für diesen Kanal",
    checklist,
    "",
    "## Ausgabe",
    "Arbeite auf Deutsch, sofern der Nutzer nicht ausdrücklich eine andere Sprache wünscht. Halte dich an die Checkliste; erwähne bei Bewertungen kurz, welche Kriterien besonders gut erfüllt sind oder fehlen.",
  );

  return sections.join("\n");
}

/**
 * Reihenfolge im kombinierten Mehrkanal-Prompt — fest und unveränderlich:
 * 1. Website, 2. Instagram, 3. LinkedIn.
 */
const CAPTION_LLM_PROMPT_CHANNEL_ORDER = Object.freeze([
  "website",
  "instagram",
  "linkedin",
] as const satisfies readonly CaptionTipsPlatform[]);

/**
 * Sammelprompt: zuerst alle Eingaben, dann Kanäle in fester Reihenfolge mit `---`,
 * Markdown-`#`-Überschrift je Kanal. Kanaltexte ohne wiederholte Eingabeliste (steht oben).
 */
function buildAllCaptionTipsLlmPrompt(form: EventFormState): string {
  const preamble = [
    "# Keyvisual Generator — aktuelle Eingaben",
    "",
    formatEventFormForLlmPrompt(form),
    "",
    "---",
    "",
    "**Kanäle (feste Reihenfolge, nicht umstellen):** 1. Website → 2. Instagram → 3. LinkedIn.",
    "Die folgenden Abschnitte enthalten je Kanal die fachlichen Hinweise und VDID-Kontexte; die Generator-Eingaben sind nur oben aufgeführt.",
    "",
    "---",
    "",
  ].join("\n");

  const blocks: string[] = [];
  for (const platform of CAPTION_LLM_PROMPT_CHANNEL_ORDER) {
    const title = CAPTION_PERFORMANCE_COPY[platform].title;
    const body = buildCaptionTipsLlmPrompt(platform, form, {
      includeFormSnapshot: false,
    });
    blocks.push(`# ${title}\n\n${body}`);
  }

  return preamble + blocks.join("\n\n---\n\n");
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
  const [imageEditSettings, setImageEditSettings] =
    React.useState<ImageEditSettings>(DEFAULT_IMAGE_EDIT_SETTINGS);
  const [imageEditModalOpen, setImageEditModalOpen] = React.useState(false);
  const [formatPreviewLightbox, setFormatPreviewLightbox] = React.useState<{
    key: FormatKey;
    dataUrl: string;
  } | null>(null);
  const [captionTipsModal, setCaptionTipsModal] =
    React.useState<CaptionTipsPlatform | null>(null);
  const [formatEnabled, setFormatEnabled] = React.useState<
    Record<FormatKey, boolean>
  >(allKeyvisualFormatsEnabled);

  const enabledFormatKeys = React.useMemo(
    () => ALL_FORMAT_KEYS.filter((key) => formatEnabled[key]),
    [formatEnabled],
  );

  const toggleFormatEnabled = (key: FormatKey, checked: boolean) => {
    setFormatEnabled((prev) => {
      if (!checked) {
        const enabledCount = ALL_FORMAT_KEYS.filter((k) => prev[k]).length;
        if (enabledCount <= 1) return prev;
      }
      return { ...prev, [key]: checked };
    });
  };

  const handleCopyAllCaptionPrompts = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(buildAllCaptionTipsLlmPrompt(form));
    } catch {
      /* clipboard API unavailable */
    }
  }, [form]);

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
    setImageEditSettings(DEFAULT_IMAGE_EDIT_SETTINGS);

    const url = URL.createObjectURL(file);
    backgroundObjectUrlRef.current = url;
    setPreviewObjectUrl(url);
    setBackgroundLoadState("loading");
    setImageEditModalOpen(true);

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

  const clearBackgroundImage = () => {
    revokeBackgroundUrl();
    backgroundImageRef.current = null;
    setPreviewObjectUrl(null);
    setPreviewNaturalSize(null);
    setBackgroundLoadState("idle");
    setImageEditSettings(DEFAULT_IMAGE_EDIT_SETTINGS);
    setImageEditModalOpen(false);
  };

  React.useEffect(() => {
    if (!captionTipsModal && !formatPreviewLightbox) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== "Escape") return;
      if (captionTipsModal) setCaptionTipsModal(null);
      else setFormatPreviewLightbox(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [captionTipsModal, formatPreviewLightbox]);

  React.useEffect(() => {
    if (!captionTipsModal && !formatPreviewLightbox) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [captionTipsModal, formatPreviewLightbox]);

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

    (enabledFormatKeys).forEach((key) => {
      const canvas = canvasRefs.current[key];
      if (!canvas) return;
      const cfg = FORMAT_CONFIG[key];
      canvas.width = cfg.width;
      canvas.height = cfg.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      drawFormat(canvas, ctx, cfg, form, logo, {
        backgroundImage,
        imageEdits: imageEditSettings,
      });
    });
  }, [
    form,
    backgroundLoadState,
    imageEditSettings,
    enabledFormatKeys,
  ]);

  React.useLayoutEffect(() => {
    if (logoLoaded) {
      renderAll();
    }
  }, [logoLoaded, renderAll]);

  const setCanvasRef = React.useCallback(
    (key: FormatKey) => (el: HTMLCanvasElement | null) => {
      canvasRefs.current[key] = el;
      if (el && logoRef.current) {
        renderAll();
      }
    },
    [renderAll],
  );

  const openFormatPreviewLightbox = (key: FormatKey) => {
    renderAll();
    const canvas = canvasRefs.current[key];
    if (!canvas || canvas.width === 0) return;
    setFormatPreviewLightbox({
      key,
      dataUrl: canvas.toDataURL("image/png"),
    });
  };

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

  const zipDownloadReady =
    assetsReady && zipTextsReady && enabledFormatKeys.length > 0;

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
    enabledFormatKeys.forEach((key) => {
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
    setImageEditSettings(DEFAULT_IMAGE_EDIT_SETTINGS);
    setImageEditModalOpen(false);
    setFormatEnabled(allKeyvisualFormatsEnabled());
    setExportHint(null);
    try {
      localStorage.removeItem(FORM_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  };

  const handleZipButtonClick = () => {
    if (enabledFormatKeys.length === 0) {
      setExportHint("Mindestens ein Bildformat auswählen.");
      return;
    }
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
          <ImageDropZone
            id="background-image"
            previewUrl={previewObjectUrl}
            onFile={(file) => applyBackgroundFile(file)}
            onClear={clearBackgroundImage}
            hint="Optional: Hintergrund für alle Formate. PNG, JPG, WebP … — sehr große Dateien können den Browser verlangsamen."
          />
          {previewObjectUrl && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setImageEditModalOpen(true)}
            >
              Bild bearbeiten…
            </Button>
          )}
        </CardContent>
      </Card>

      <ImageEditModal
        open={imageEditModalOpen}
        onClose={() => setImageEditModalOpen(false)}
        title="Hintergrund bearbeiten"
        imageUrl={previewObjectUrl}
        naturalSize={previewNaturalSize}
        settings={imageEditSettings}
        onSettingsChange={setImageEditSettings}
        onFileSelected={(file) => applyBackgroundFile(file)}
        onClearImage={clearBackgroundImage}
        idPrefix="keyvisual-bg"
        uploadHint="PNG, JPG, WebP …"
      />

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
            onClick={() => void handleCopyAllCaptionPrompts()}
            aria-label="Prompt in die Zwischenablage kopieren"
          >
            Prompt kopieren
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <CaptionFieldLabel
                htmlFor="captionWebsite"
                label="Caption Website"
                required
                onOpenTips={() => setCaptionTipsModal("website")}
              />
              <Textarea
                id="captionWebsite"
                value={form.captionWebsite}
                onChange={handleChangeText("captionWebsite")}
                placeholder="Begleittext für Web / CMS"
                rows={5}
                className="resize-y min-h-[100px]"
              />
              <CharCount
                value={form.captionWebsite}
                softLimit={CAPTION_SWEET_SPOT.website}
              />
            </div>
            <div className="space-y-1">
              <CaptionFieldLabel
                htmlFor="captionInstagram"
                label="Caption Instagram"
                required
                onOpenTips={() => setCaptionTipsModal("instagram")}
              />
              <Textarea
                id="captionInstagram"
                value={form.captionInstagram}
                onChange={handleChangeText("captionInstagram")}
                placeholder="Post-Text / Bildunterschrift"
                rows={5}
                className="resize-y min-h-[100px]"
              />
              <CharCount
                value={form.captionInstagram}
                softLimit={CAPTION_SWEET_SPOT.instagram}
              />
            </div>
            <div className="space-y-1">
              <CaptionFieldLabel
                htmlFor="captionLinkedIn"
                label="Caption LinkedIn"
                required
                onOpenTips={() => setCaptionTipsModal("linkedin")}
              />
              <Textarea
                id="captionLinkedIn"
                value={form.captionLinkedIn}
                onChange={handleChangeText("captionLinkedIn")}
                placeholder="Beitragstext für LinkedIn"
                rows={5}
                className="resize-y min-h-[100px]"
              />
              <CharCount
                value={form.captionLinkedIn}
                softLimit={CAPTION_SWEET_SPOT.linkedin}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Export-Formate</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            {ALL_FORMAT_KEYS.map((key) => (
              <div key={key} className="flex items-center gap-2">
                <Checkbox
                  id={`format-${key}`}
                  checked={formatEnabled[key]}
                  onChange={(e) =>
                    toggleFormatEnabled(key, e.target.checked)
                  }
                />
                <Label htmlFor={`format-${key}`} className="cursor-pointer">
                  {FORMAT_CONFIG[key].label}
                </Label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {enabledFormatKeys.map((key) => {
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
                        ref={setCanvasRef(key)}
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
              {enabledFormatKeys.length < ALL_FORMAT_KEYS.length && (
                <span className="ml-1 font-normal opacity-80">
                  ({enabledFormatKeys.length} Formate)
                </span>
              )}
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

      {typeof document !== "undefined" &&
        captionTipsModal &&
        createPortal(
          <PerformanceTipsModal
            platform={captionTipsModal}
            onClose={() => setCaptionTipsModal(null)}
          />,
          document.body,
        )}

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

/** Brand blue #0A2CD9 — same as solid fallback background. */

type BackgroundDrawOptions = {
  backgroundImage: HTMLImageElement | null;
  imageEdits: ImageEditSettings;
};

type KeyvisualTextLayout = {
  titleFontSize: number;
  metaFontSize: number;
  subtitleFontSize: number;
  lineHeightTitle: number;
  lineHeightSubtitle: number;
  eventFormatLines: string[];
  titleLines: string[];
  subtitleLines: string[];
  spacingAfterEventFormat: number;
  spacingAfterTitle: number;
  spacingAfterSubtitle: number;
  totalTextHeight: number;
  textStartY: number;
  metaParts: string[];
};

function measureKeyvisualTextLayout(
  ctx: CanvasRenderingContext2D,
  args: {
    titleFontSize: number;
    titleMaxWidth: number;
    width: number;
    height: number;
    marginY: number;
    minTextStartY: number;
    includeMeta: boolean;
    eventFormatText: string;
    title: string;
    subtitle: string;
    metaParts: string[];
  },
): KeyvisualTextLayout {
  const {
    titleFontSize,
    titleMaxWidth,
    width,
    height,
    marginY,
    minTextStartY,
    includeMeta,
    eventFormatText,
    title,
    subtitle,
    metaParts,
  } = args;

  const metaFontSize = titleFontSize * 0.45;
  const subtitleFontSize = titleFontSize * 0.55;
  const lineHeightTitle = titleFontSize * 1.2;
  const lineHeightSubtitle = subtitleFontSize * 1.3;

  ctx.font = `400 ${metaFontSize}px Roboto, system-ui, sans-serif`;
  const eventFormatLines = eventFormatText
    ? wrapText(ctx, eventFormatText, titleMaxWidth)
    : [];

  ctx.font = `500 ${titleFontSize}px Roboto, system-ui, sans-serif`;
  const titleLines = title.trim() ? wrapText(ctx, title, titleMaxWidth) : [];

  ctx.font = `400 ${subtitleFontSize}px Roboto, system-ui, sans-serif`;
  const subtitleLines = subtitle ? wrapText(ctx, subtitle, titleMaxWidth) : [];

  const spacingAfterEventFormat = metaFontSize * 0.8;
  const spacingAfterTitle = subtitleFontSize * 0.8;
  const spacingAfterSubtitle = metaFontSize * 1.0;

  const eventFormatHeight = eventFormatLines.length * metaFontSize * 1.2;
  const titleHeight = titleLines.length * lineHeightTitle;
  const subtitleHeight = subtitleLines.length * lineHeightSubtitle;
  const metaHeight = metaFontSize * 1.4;

  let totalTextHeight = 0;
  if (eventFormatText && eventFormatLines.length > 0) {
    totalTextHeight += eventFormatHeight + spacingAfterEventFormat;
  }
  totalTextHeight += titleHeight;

  if (includeMeta) {
    if (subtitle && subtitleLines.length > 0) {
      totalTextHeight +=
        (titleLines.length > 0 ? spacingAfterTitle : 0) + subtitleHeight;
    }
    if (metaParts.length > 0) {
      totalTextHeight += spacingAfterSubtitle + metaHeight;
    }
  }

  const lowerThirdStart = height * 0.67;
  const maxTextEndY = height - marginY;

  let textStartY: number;
  if (includeMeta) {
    const bottomPosition = height - marginY - totalTextHeight;
    textStartY = Math.max(bottomPosition, lowerThirdStart, minTextStartY);
    if (textStartY + totalTextHeight > maxTextEndY) {
      textStartY = Math.max(maxTextEndY - totalTextHeight, minTextStartY);
    }
  } else {
    textStartY = Math.max(lowerThirdStart, minTextStartY);
  }

  return {
    titleFontSize,
    metaFontSize,
    subtitleFontSize,
    lineHeightTitle,
    lineHeightSubtitle,
    eventFormatLines,
    titleLines,
    subtitleLines,
    spacingAfterEventFormat,
    spacingAfterTitle,
    spacingAfterSubtitle,
    totalTextHeight,
    textStartY,
    metaParts,
  };
}

function drawFormat(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  cfg: FormatCanvasConfig,
  form: EventFormState,
  logo: HTMLImageElement,
  background: BackgroundDrawOptions,
) {
  const { width, height } = cfg;
  const { backgroundImage, imageEdits } = background;

  // Background: photo with focal cover, or solid VDID blue
  if (backgroundImage && backgroundImage.complete) {
    drawBackgroundCover(
      ctx,
      width,
      height,
      backgroundImage,
      imageEdits.focalPoint.x,
      imageEdits.focalPoint.y,
      imageEdits.grayscaleEnabled,
    );
  } else {
    ctx.fillStyle = "#0A2CD9";
    ctx.fillRect(0, 0, width, height);
  }

  applyImageEditOverlays(ctx, width, height, imageEdits);

  // Safe margins (typography / copyright)
  const marginX = width * 0.08;
  const marginY = height * 0.12;

  // Logo: offset from canvas corner = one VDID mark-square side at current scale,
  // plus optional IG Story top safe area for system UI.
  const lnw = logo.naturalWidth || logo.width;
  const lnh = logo.naturalHeight || logo.height;
  const logoHeight = Math.min(height * 0.16, 160);
  const logoAspect = lnw / lnh || 1;
  const logoWidth = logoHeight * logoAspect;
  const lnhSafe = lnh > 0 ? lnh : VDID_LOGO_VIEWBOX_SIZE;
  const unitSquarePx = logoHeight * (VDID_LOGO_MARK_SQUARE / lnhSafe);
  const storyTopSafePx =
    cfg.topUiSafeInsetRatio != null && cfg.topUiSafeInsetRatio > 0
      ? height * cfg.topUiSafeInsetRatio
      : 0;
  const logoX = unitSquarePx;
  const logoY = unitSquarePx + storyTopSafePx;
  ctx.drawImage(logo, logoX, logoY, logoWidth, logoHeight);

  // Typography - positioned in lower third
  const titleMaxWidth = width - marginX * 2;

  const baseTitleSize = Math.max(32, Math.min(width, height) * 0.07);
  const minTitleSize = 22;
  const maxTitleSize = Math.round(baseTitleSize * 1.7);
  const logoBottom = logoY + logoHeight;
  const minDistanceFromLogo = height * 0.05;
  const minTextStartY = logoBottom + minDistanceFromLogo;
  const maxTextEndY = height - marginY;

  const eventFormatText =
    form.eventFormat === "other"
      ? form.eventFormatCustom
      : form.eventFormat !== "–"
        ? form.eventFormat
        : "";

  const dateText = form.date ? format(form.date, "dd.MM.yyyy") : "";
  const metaParts = [dateText, form.time].filter(Boolean);
  if (form.isOnline) {
    metaParts.push("Online");
  } else if (form.place) {
    metaParts.push(form.place);
  }

  const measureArgs = {
    titleMaxWidth,
    width,
    height,
    marginY,
    minTextStartY,
    includeMeta: cfg.includeMeta,
    eventFormatText,
    title: form.title,
    subtitle: form.subtitle,
    metaParts,
  };

  let titleFontSize = baseTitleSize;
  let layout = measureKeyvisualTextLayout(ctx, {
    ...measureArgs,
    titleFontSize,
  });

  while (
    titleFontSize > minTitleSize &&
    layout.textStartY + layout.totalTextHeight > maxTextEndY
  ) {
    titleFontSize -= 1;
    layout = measureKeyvisualTextLayout(ctx, { ...measureArgs, titleFontSize });
  }

  while (titleFontSize < maxTitleSize) {
    const nextLayout = measureKeyvisualTextLayout(ctx, {
      ...measureArgs,
      titleFontSize: titleFontSize + 1,
    });
    if (
      nextLayout.textStartY + nextLayout.totalTextHeight > maxTextEndY ||
      nextLayout.textStartY < minTextStartY
    ) {
      break;
    }
    titleFontSize += 1;
    layout = nextLayout;
  }

  ctx.fillStyle = "#FFFFFF";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  const {
    metaFontSize,
    subtitleFontSize,
    lineHeightTitle,
    lineHeightSubtitle,
    eventFormatLines,
    titleLines,
    subtitleLines,
    spacingAfterEventFormat,
    spacingAfterTitle,
    spacingAfterSubtitle,
    textStartY,
  } = layout;

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
  ctx.font = `500 ${layout.titleFontSize}px Roboto, system-ui, sans-serif`;
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
  _marginX: number,
  _marginY: number,
) {
  const trimmed = text.trim();
  if (!trimmed) return;

  const display = copyrightDisplayText(trimmed);
  /** Leave room for cap-height insets top/bottom once positioned. */
  const maxSpan = Math.max(40, height - 8);

  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.5)";

  let fontSize = Math.max(10, Math.min(width, height) * 0.017);
  const minSize = 8;
  while (fontSize >= minSize) {
    ctx.font = `400 ${fontSize}px Roboto, system-ui, sans-serif`;
    if (ctx.measureText(display).width <= maxSpan) break;
    fontSize -= 0.5;
  }
  ctx.font = `400 ${fontSize}px Roboto, system-ui, sans-serif`;

  // Inset from bottom & right ≈ Versalhöhe: gleicher Abstand Baseline→untere Kante wie Typometrie.
  const capProbe = ctx.measureText("H");
  const capHeight =
    capProbe.actualBoundingBoxAscent ??
    capProbe.fontBoundingBoxAscent ??
    fontSize * 0.72;
  const inset = Math.max(2, capHeight);
  /** Nudge anchor slightly up and left (along canvas axes before rotation). */
  const nudge = Math.min(width, height);
  const nudgeLeft = nudge * 0.018;
  const nudgeUp = nudge * 0.018;

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  // Baseline start unten rechts mit inset; nach CCW 90° (canvas: neg. Winkel) läuft die Zeile nach oben.
  ctx.translate(width - inset - nudgeLeft, height - inset - nudgeUp);
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


import { DEFAULT_IMAGE_EDIT_SETTINGS } from "@/lib/image-edit";
import type {
  CustomTemplate,
  TemplateElement,
  TemplateOverlayAsset,
  TextTemplateElement,
} from "@/lib/custom-template";
import { collectTemplateAssetSrcs } from "@/lib/custom-template";
import {
  WDC_BG_FILE,
  WDC_BLUE,
  WDC_CONTENT_RIGHT,
  WDC_CONTENT_WIDTH,
  WDC_LOGO_BOX,
  WDC_MARGIN,
  WDC_SIDEBAR_BOX,
  WDC_SIDEBAR_FILE,
  WDC_SIDEBAR_FILL,
  WDC_TEXT,
} from "@/lib/wdc-theme";

const BASE_ASPECT = 1;

function textStyle(
  heightFraction: number,
  extras: Partial<TextTemplateElement["style"]> & { fontWeight: string },
): TextTemplateElement["style"] {
  return {
    heightFraction,
    fontWeight: extras.fontWeight,
    baseColor: extras.baseColor ?? WDC_TEXT,
    highlightColor: extras.highlightColor ?? WDC_TEXT,
    align: extras.align ?? "left",
    lineHeightRatio: extras.lineHeightRatio ?? 1.2,
    autoFit: extras.autoFit ?? true,
  };
}

function chromeOverlays(): TemplateOverlayAsset[] {
  return [
    {
      src: WDC_SIDEBAR_FILE,
      box: { ...WDC_SIDEBAR_BOX },
      fit: "contain",
      backgroundFill: WDC_SIDEBAR_FILL,
    },
  ];
}

function logoEl(): TemplateElement {
  return {
    id: "wdc-logo",
    kind: "logo",
    variant: "white",
    box: { ...WDC_LOGO_BOX },
  };
}

function contentBox(y: number, h: number) {
  return { x: WDC_MARGIN, y, w: WDC_CONTENT_WIDTH, h };
}

function wdcTemplate(
  id: string,
  name: string,
  elements: TemplateElement[],
): CustomTemplate {
  return {
    id,
    name,
    baseAspect: BASE_ASPECT,
    backgroundColor: WDC_BLUE,
    backgroundImageSrc: WDC_BG_FILE,
    overlayAssets: chromeOverlays(),
    elements,
    guides: {
      vertical: [WDC_MARGIN, WDC_CONTENT_RIGHT, WDC_SIDEBAR_BOX.x],
      horizontal: [WDC_MARGIN, 1 - WDC_MARGIN],
    },
  };
}

const TITLE_HEADING = "DIE TRANSFORMATIVE KRAFT DES DESIGNS";
const TITLE_DATE = "30.–31.10.2026\nCircle Cube\nHafenallee 57, Offenbach";

function titleTextElements(idPrefix: string): TemplateElement[] {
  return [
    {
      id: `${idPrefix}-label`,
      kind: "text",
      field: "formatLabel",
      label: "Formatzeile",
      defaultText: "Designforum",
      style: textStyle(0.028, { fontWeight: "400", autoFit: false }),
      box: contentBox(0.26, 0.045),
    },
    {
      id: `${idPrefix}-heading`,
      kind: "text",
      field: "heading",
      label: "Titel",
      defaultText: TITLE_HEADING,
      style: textStyle(0.052, {
        fontWeight: "700",
        lineHeightRatio: 1.08,
        autoFit: true,
      }),
      box: contentBox(0.31, 0.26),
    },
    {
      id: `${idPrefix}-date`,
      kind: "text",
      field: "dateLine",
      label: "Datum / Ort",
      defaultText: TITLE_DATE,
      style: textStyle(0.028, {
        fontWeight: "400",
        lineHeightRatio: 1.35,
        autoFit: false,
      }),
      box: contentBox(0.6, 0.18),
    },
  ];
}

const title = wdcTemplate("wdc-title", "Titel", [
  ...titleTextElements("wdc-title"),
  logoEl(),
]);

const titlePhoto = wdcTemplate("wdc-title-photo", "Titel mit Foto", [
  {
    id: "wdc-title-photo-image",
    kind: "image",
    slot: "photo",
    label: "Hintergrundfoto",
    box: { x: 0, y: 0, w: WDC_SIDEBAR_BOX.x, h: 1 },
    defaultEdits: {
      ...DEFAULT_IMAGE_EDIT_SETTINGS,
      blueTintEnabled: true,
      blueTintOpacity: 0.48,
    },
  },
  {
    id: "wdc-title-photo-wash",
    kind: "rect",
    fill: WDC_BLUE,
    radiusFraction: 0,
    opacity: 0.28,
    box: { x: 0, y: 0, w: WDC_SIDEBAR_BOX.x, h: 1 },
  },
  ...titleTextElements("wdc-title-photo"),
  { ...logoEl(), id: "wdc-title-photo-logo" },
]);

const list = wdcTemplate("wdc-list", "Sprecherliste", [
  {
    id: "wdc-list-body",
    kind: "text",
    field: "body",
    label: "Liste",
    defaultText:
      "Janina Forberger / Vice President @ Miele Design\nOliver Keller / Executive Director @ TEAMS\nProf. Dr. Christa Liedtke / Wuppertal Institut",
    style: textStyle(0.026, {
      fontWeight: "400",
      lineHeightRatio: 1.55,
      autoFit: true,
    }),
    box: contentBox(0.24, 0.58),
  },
  {
    id: "wdc-list-cta",
    kind: "text",
    field: "contact",
    label: "Footer",
    defaultText: ">>",
    style: textStyle(0.045, {
      fontWeight: "700",
      align: "right",
      autoFit: false,
    }),
    box: {
      x: WDC_MARGIN,
      y: 0.86,
      w: WDC_CONTENT_WIDTH,
      h: 0.07,
    },
  },
  { ...logoEl(), id: "wdc-list-logo" },
]);

const quote = wdcTemplate("wdc-quote", "Zitat", [
  {
    id: "wdc-quote-body",
    kind: "text",
    field: "body",
    label: "Zitat",
    defaultText:
      "„Gestaltung ersetzt permanent Werte und Haltungen, die Veränderungen in der Welt bewirken.“",
    style: textStyle(0.04, {
      fontWeight: "700",
      lineHeightRatio: 1.25,
      autoFit: true,
    }),
    box: contentBox(0.24, 0.46),
  },
  {
    id: "wdc-quote-name",
    kind: "text",
    field: "name",
    label: "Name",
    defaultText: "Prof. Dr. Christa Liedtke",
    style: textStyle(0.022, { fontWeight: "700", autoFit: false }),
    box: contentBox(0.74, 0.04),
  },
  {
    id: "wdc-quote-role",
    kind: "text",
    field: "role",
    label: "Rolle",
    defaultText:
      "Abteilungsleiterin Nachhaltiges Produzieren und Konsumieren, Wuppertal Institut",
    style: textStyle(0.018, {
      fontWeight: "400",
      lineHeightRatio: 1.3,
      autoFit: true,
    }),
    box: contentBox(0.79, 0.1),
  },
  { ...logoEl(), id: "wdc-quote-logo" },
]);

const question = wdcTemplate("wdc-question", "Frage", [
  {
    id: "wdc-question-heading",
    kind: "text",
    field: "heading",
    label: "Frage",
    defaultText:
      "Wie verändert sich Design in der Praxis im Spannungsfeld von KI, Zirkularität und neuer Ökonomie?",
    style: textStyle(0.042, {
      fontWeight: "700",
      lineHeightRatio: 1.18,
      autoFit: true,
    }),
    box: contentBox(0.26, 0.48),
  },
  {
    id: "wdc-question-cta",
    kind: "text",
    field: "contact",
    label: "Aufruf",
    defaultText: "Diskutiert mit uns!  >>",
    style: textStyle(0.026, {
      fontWeight: "400",
      align: "right",
      autoFit: false,
    }),
    box: {
      x: WDC_MARGIN,
      y: 0.84,
      w: WDC_CONTENT_WIDTH,
      h: 0.07,
    },
  },
  { ...logoEl(), id: "wdc-question-logo" },
]);

const speaker = wdcTemplate("wdc-speaker", "Sprecher", [
  {
    id: "wdc-speaker-photo",
    kind: "image",
    slot: "photo",
    label: "Porträt",
    box: { x: 0.22, y: 0.16, w: 0.48, h: 0.48 },
    defaultEdits: {
      ...DEFAULT_IMAGE_EDIT_SETTINGS,
      grayscaleEnabled: true,
    },
  },
  {
    id: "wdc-speaker-name",
    kind: "text",
    field: "name",
    label: "Name",
    defaultText: "Prof. Dr. Christa Liedtke",
    style: textStyle(0.032, { fontWeight: "700", autoFit: true }),
    box: contentBox(0.68, 0.06),
  },
  {
    id: "wdc-speaker-role",
    kind: "text",
    field: "role",
    label: "Rolle",
    defaultText:
      "Abteilungsleiterin Nachhaltiges Produzieren und Konsumieren\nWuppertal Institut",
    style: textStyle(0.02, {
      fontWeight: "400",
      lineHeightRatio: 1.3,
      autoFit: true,
    }),
    box: contentBox(0.75, 0.14),
  },
  { ...logoEl(), id: "wdc-speaker-logo" },
]);

const partner = wdcTemplate("wdc-partner", "Partner", [
  {
    id: "wdc-partner-1",
    kind: "partnerLogo",
    slot: "partner",
    label: "Partner-Logo 1",
    box: { x: WDC_MARGIN, y: 0.34, w: 0.22, h: 0.2 },
  },
  {
    id: "wdc-partner-2",
    kind: "partnerLogo",
    slot: "partner2",
    label: "Partner-Logo 2",
    box: { x: 0.325, y: 0.3, w: 0.26, h: 0.28 },
  },
  {
    id: "wdc-partner-3",
    kind: "partnerLogo",
    slot: "partner3",
    label: "Partner-Logo 3",
    box: { x: 0.61, y: 0.34, w: 0.22, h: 0.2 },
  },
  {
    id: "wdc-partner-label-1",
    kind: "text",
    field: "partnerLabel1",
    label: "Label 1",
    defaultText: "",
    style: textStyle(0.016, { fontWeight: "400", autoFit: false }),
    box: { x: WDC_MARGIN, y: 0.56, w: 0.22, h: 0.06 },
  },
  {
    id: "wdc-partner-label-2",
    kind: "text",
    field: "partnerLabel2",
    label: "Label 2",
    defaultText: "",
    style: textStyle(0.016, { fontWeight: "400", autoFit: false }),
    box: { x: 0.325, y: 0.6, w: 0.26, h: 0.06 },
  },
  {
    id: "wdc-partner-label-3",
    kind: "text",
    field: "partnerLabel3",
    label: "Label 3",
    defaultText: "",
    style: textStyle(0.016, { fontWeight: "400", autoFit: false }),
    box: { x: 0.61, y: 0.56, w: 0.22, h: 0.06 },
  },
  { ...logoEl(), id: "wdc-partner-logo" },
]);

export const WDC_TEMPLATES: CustomTemplate[] = [
  title,
  titlePhoto,
  list,
  quote,
  question,
  speaker,
  partner,
];

export const WDC_TEMPLATE_MAP = new Map(
  WDC_TEMPLATES.map((template) => [template.id, template]),
);

export const WDC_DEFAULT_TEMPLATE_ID = title.id;

export const WDC_TEMPLATE_CAPTIONS: Record<string, string> = {
  "wdc-title":
    "Event-Intro mit Formatzeile, großem Titel und Datum/Ort — für Ankündigungen.",
  "wdc-title-photo":
    "Wie Titel, plus Foto unter einem blauen Wash — für Location- oder Stimmungsbilder.",
  "wdc-list":
    "Namens- und Rollenliste mit Pfeil-Footer — für Speaker:innen und Programm.",
  "wdc-quote": "Großes Zitat mit Name und Funktion unten links.",
  "wdc-question":
    "Leitfrage mit Aufruf „Diskutiert mit uns!“ — für Diskussionsposts.",
  "wdc-speaker":
    "Quadrat-Porträt (standardmäßig Schwarzweiß) mit Name und Titel.",
  "wdc-partner":
    "Bis zu drei Partner-Logos. Ein Logo in der Mitte reicht für Mentor.",
};

export function collectWdcAssetSrcs(): string[] {
  const srcs = new Set<string>();
  for (const template of WDC_TEMPLATES) {
    for (const src of collectTemplateAssetSrcs(template)) srcs.add(src);
  }
  return [...srcs];
}

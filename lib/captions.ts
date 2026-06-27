import type JSZip from "jszip";
import { exportAssetBasename } from "@/lib/export-naming";

export type CaptionTipsPlatform = "website" | "instagram" | "linkedin";

export type CaptionSet = {
  captionWebsite: string;
  captionInstagram: string;
  captionLinkedIn: string;
};

export const EMPTY_CAPTIONS: CaptionSet = {
  captionWebsite: "",
  captionInstagram: "",
  captionLinkedIn: "",
};

export const WEBSITE_REFERENCE_CONTEXT_CHAR_COUNT = 1700;

export const CAPTION_SWEET_SPOT: Record<CaptionTipsPlatform, number> = {
  website: WEBSITE_REFERENCE_CONTEXT_CHAR_COUNT,
  instagram: 400,
  linkedin: 1400,
};

export const CAPTION_PERFORMANCE_COPY: Record<
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

const VDID_ORG_DESCRIPTION_FOR_LLM = `Der VDID — Verband der Industrie Designerinnen und Designer e. V. — ist der Berufsverband für Industrie- und Produktdesign in Deutschland. Er vertritt die beruflichen und fachpolitischen Interessen von Industrie-Designerinnen und -designern, stärkt den Austausch innerhalb der Community und mit Partnern aus Wirtschaft, Wissenschaft und Öffentlichkeit und macht die Rolle von Design für Innovation, Qualität und gesellschaftliche Entwicklung sichtbar.

Formate wie »Design.Wissen.Diskurs.« oder »Insight Update« sowie regionale und überregionale Events vernetzen die Szene und transportieren Designthemen in die Öffentlichkeit.

Für Begleittexte gilt: sachlich-präzise und zugänglich; professionell ohne Marketing-Pathos; die gestalterische Expertise der Community würdigen; inklusive und respektvolle Ansprache bevorzugen.`;

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

const PLATFORM_LENGTH_GUIDANCE: Record<CaptionTipsPlatform, string> = {
  website: `Referenzumfang ausführlicher Website-Begleittexte ca. ${WEBSITE_REFERENCE_CONTEXT_CHAR_COUNT} Zeichen (VDID-Beispielkorpus, inkl. Absatzumbrüche). SERP/Meta-Snippets sind kurz (~150–160 sichtbar) — bei Bedarf zusätzlich kondensieren.`,
  instagram:
    "Typische Bandbreite für Feed und Karussell — oft genanntes Engagement-Fenster etwa 300–500 Zeichen; der Wert unten ist eine mittlere Orientierung.",
  linkedin:
    "Typische Bandbreite für längere Fachposts — viele Benchmarks für starkes Engagement bei etwa 1200–1600 Zeichen.",
};

const CAPTION_LLM_PROMPT_CHANNEL_ORDER = Object.freeze([
  "website",
  "instagram",
  "linkedin",
] as const satisfies readonly CaptionTipsPlatform[]);

/** VDID Lab: social captions only (no website). */
export const LAB_CAPTION_PLATFORMS: CaptionTipsPlatform[] = [
  "instagram",
  "linkedin",
];

export function captionDraftBlock(label: string, text: string): string {
  const t = text.trim();
  if (!t) return `**${label}**\n  *(noch leer)*`;
  const indented = text.split("\n").map((line) => `  ${line}`).join("\n");
  return `**${label}**\n${indented}`;
}

export type BuildCaptionTipsLlmPromptOptions = {
  includeFormSnapshot?: boolean;
  sourceLabel?: string;
};

export function buildCaptionTipsLlmPrompt(
  platform: CaptionTipsPlatform,
  formSnapshot: string,
  options?: BuildCaptionTipsLlmPromptOptions,
): string {
  const includeFormSnapshot = options?.includeFormSnapshot ?? true;
  const sourceLabel = options?.sourceLabel ?? "Generator";
  const meta = CAPTION_PERFORMANCE_COPY[platform];
  const softChars = CAPTION_SWEET_SPOT[platform];
  const lengthNote = PLATFORM_LENGTH_GUIDANCE[platform];
  const checklist = meta.tips.map((tip, i) => `${i + 1}. ${tip}`).join("\n");

  const sections: string[] = [
    "Du bist ein erfahrener Redakteur für Organisations- und Eventkommunikation.",
    "",
    "## Auftrag",
    "Formuliere, überarbeite oder bewerte Begleittexte (Captions) für Veröffentlichungen — angelehnt an die folgenden kanalspezifischen Qualitätskriterien.",
    "",
  ];

  if (includeFormSnapshot) {
    sections.push(
      `## Aktuelle Eingaben aus dem ${sourceLabel}`,
      "Nutze diese Angaben als Faktengrundlage; Platzhalter bedeuten: Feld noch leer oder nicht gewählt.",
      "",
      formSnapshot,
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

export function buildAllCaptionTipsLlmPrompt(
  preambleTitle: string,
  formSnapshot: string,
  sourceLabel: string,
  platforms: readonly CaptionTipsPlatform[] = CAPTION_LLM_PROMPT_CHANNEL_ORDER,
): string {
  const channelList = platforms
    .map((p, i) => `${i + 1}. ${CAPTION_PERFORMANCE_COPY[p].title}`)
    .join(" → ");

  const preamble = [
    `# ${preambleTitle}`,
    "",
    formSnapshot,
    "",
    "---",
    "",
    `**Kanäle (feste Reihenfolge, nicht umstellen):** ${channelList}.`,
    "Die folgenden Abschnitte enthalten je Kanal die fachlichen Hinweise und VDID-Kontexte; die Generator-Eingaben sind nur oben aufgeführt.",
    "",
    "---",
    "",
  ].join("\n");

  const blocks: string[] = [];
  for (const platform of platforms) {
    const title = CAPTION_PERFORMANCE_COPY[platform].title;
    const body = buildCaptionTipsLlmPrompt(platform, formSnapshot, {
      includeFormSnapshot: false,
      sourceLabel,
    });
    blocks.push(`# ${title}\n\n${body}`);
  }

  return preamble + blocks.join("\n\n---\n\n");
}

const CAPTION_ZIP_ITEMS = [
  { slug: "Caption-Website", channel: "website", key: "captionWebsite" },
  { slug: "Caption-Instagram", channel: "instagram", key: "captionInstagram" },
  { slug: "Caption-LinkedIn", channel: "linkedin", key: "captionLinkedIn" },
] as const satisfies readonly {
  slug: string;
  channel: CaptionTipsPlatform;
  key: keyof CaptionSet;
}[];

export type CaptionZipArchiveEntry = {
  channel: CaptionTipsPlatform;
  filename: string;
};

export function addCaptionsToZip(
  zip: JSZip,
  exportTitle: string,
  captions: CaptionSet,
  downloadDate: Date,
  platforms: readonly CaptionTipsPlatform[] = CAPTION_LLM_PROMPT_CHANNEL_ORDER,
): CaptionZipArchiveEntry[] {
  const entries: CaptionZipArchiveEntry[] = [];

  for (const item of CAPTION_ZIP_ITEMS) {
    if (!platforms.includes(item.channel)) continue;
    const txtName = `${exportAssetBasename(exportTitle, item.slug, downloadDate)}.txt`;
    zip.file(txtName, captions[item.key].trim());
    entries.push({ channel: item.channel, filename: txtName });
  }

  return entries;
}

export function collectCaptionZipMissing(
  captions: CaptionSet,
  exportTitle: string,
  platforms: readonly CaptionTipsPlatform[] = CAPTION_LLM_PROMPT_CHANNEL_ORDER,
): string[] {
  const missing: string[] = [];
  if (!exportTitle.trim()) missing.push("Titel");
  if (platforms.includes("website") && !captions.captionWebsite.trim()) {
    missing.push("Caption Website");
  }
  if (platforms.includes("instagram") && !captions.captionInstagram.trim()) {
    missing.push("Caption Instagram");
  }
  if (platforms.includes("linkedin") && !captions.captionLinkedIn.trim()) {
    missing.push("Caption LinkedIn");
  }
  return missing;
}

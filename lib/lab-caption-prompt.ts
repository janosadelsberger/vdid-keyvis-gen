import { captionDraftBlock } from "@/lib/captions";
import { stripMarkdown } from "@/lib/canvas-richtext";
import type { LabSlide } from "@/lib/lab-slide-render";
import type { CaptionSet } from "@/lib/captions";

function blankAsUnset(value: string | undefined): string {
  const t = value?.trim() ?? "";
  return t.length > 0 ? t : "*(nicht angegeben)*";
}

/** Formularfelder aus VDID Lab für LLM-Prompts (Markdown). */
export function formatLabDeckForLlmPrompt(
  slides: LabSlide[],
  captions: CaptionSet,
): string {
  const slideBlocks = slides.map((slide, i) => {
    const lines = [
      `### Post ${i + 1}`,
      `- **Vorlage:** ${slide.type}`,
      `- **Titel:** ${blankAsUnset(slide.heading ? stripMarkdown(slide.heading) : "")}`,
    ];
    if (slide.formatLabel?.trim()) {
      lines.push(`- **Formatzeile:** ${slide.formatLabel.trim()}`);
    }
    if (slide.dateLine?.trim()) {
      lines.push(`- **Datum / Uhrzeit:** ${slide.dateLine.trim()}`);
    }
    if (slide.body?.trim()) {
      lines.push(`- **Text:** ${stripMarkdown(slide.body)}`);
    }
    if (slide.name?.trim()) {
      lines.push(`- **Name:** ${slide.name.trim()}`);
    }
    if (slide.role?.trim()) {
      lines.push(`- **Rolle:** ${slide.role.trim()}`);
    }
    if (slide.contact?.trim()) {
      lines.push(`- **Kontakt:** ${stripMarkdown(slide.contact)}`);
    }
    return lines.join("\n");
  });

  return [
    `- **Anzahl Posts:** ${slides.length}`,
    "",
    slideBlocks.join("\n\n"),
    "",
    captionDraftBlock("Caption-Entwurf Instagram", captions.captionInstagram),
    "",
    captionDraftBlock("Caption-Entwurf LinkedIn", captions.captionLinkedIn),
  ].join("\n");
}

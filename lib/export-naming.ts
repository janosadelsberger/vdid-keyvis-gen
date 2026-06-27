import { format } from "date-fns";

export function sanitizeTitleForFilename(raw: string): string {
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
export function exportAssetBasename(
  title: string,
  formatSlug: string,
  downloadDate: Date,
): string {
  const yymmdd = format(downloadDate, "yyMMdd");
  return `${yymmdd}_${sanitizeTitleForFilename(title)}_${formatSlug}`;
}

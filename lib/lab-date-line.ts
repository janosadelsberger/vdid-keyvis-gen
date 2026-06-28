import { format, isValid, parse } from "date-fns";

export type ParsedDateLine = {
  date: Date | null;
  time: string;
};

/** Split `dateLine` into date + time (`20.05.2026 | 9:00–13:00`). */
export function parseDateLine(dateLine: string | undefined): ParsedDateLine {
  const trimmed = dateLine?.trim() ?? "";
  if (!trimmed) return { date: null, time: "" };

  const pipeIdx = trimmed.indexOf("|");
  if (pipeIdx !== -1) {
    const datePart = trimmed.slice(0, pipeIdx).trim();
    const timePart = trimmed.slice(pipeIdx + 1).trim();
    return {
      date: parseGermanDate(datePart),
      time: timePart,
    };
  }

  const asDate = parseGermanDate(trimmed);
  if (asDate) return { date: asDate, time: "" };

  return { date: null, time: trimmed };
}

export function formatDateLine(date: Date | null, time: string): string {
  const datePart = date ? format(date, "dd.MM.yyyy") : "";
  const timePart = time.trim();
  if (datePart && timePart) return `${datePart} | ${timePart}`;
  if (datePart) return datePart;
  return timePart;
}

/** Normalize stored time text for `<input type="time">` (HH:mm). */
export function timeForPicker(time: string): string {
  const t = time.trim();
  if (!t) return "";
  if (/^\d{2}:\d{2}$/.test(t)) return t;
  const match = t.match(/^(\d{1,2}):(\d{2})/);
  if (match) {
    return `${match[1].padStart(2, "0")}:${match[2]}`;
  }
  return "";
}

function parseGermanDate(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = parse(trimmed, "dd.MM.yyyy", new Date());
  return isValid(parsed) ? parsed : null;
}

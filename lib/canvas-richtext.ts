export type RichTextRun = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  highlight?: boolean;
};

export type RichTextLine = RichTextRun[];

export type DrawRichTextOptions = {
  x: number;
  y: number;
  maxWidth: number;
  fontSize: number;
  fontWeight?: string;
  lineHeight?: number;
  baseColor?: string;
  highlightColor?: string;
  fontFamily?: string;
  textAlign?: "left" | "right";
};

export const MARKDOWN_FORMAT_HINT =
  "Markdown: **fett & blau**, __fett__, *kursiv*, [[nur blau]]";

export const CANVAS_BREAK_HINT =
  "Enter: Return · Shift+Enter: Soft Return (enger)";

/** Shift+Enter: newline + zero-width space, so the field still shows a line break. */
export const SOFT_RETURN = "\n\u200B";

/** Auto-wrap and Enter: normal line height. */
export const RICH_TEXT_WRAP_GAP = 1;
/** Same as wrap — a normal Return (`\\n`). */
export const RICH_TEXT_RETURN_GAP = 1;
/** Shift+Enter: tighter than a normal return. */
export const RICH_TEXT_SOFT_BREAK_GAP = 0.82;
/** Two Returns (`\\n\\n`): one empty line. */
export const RICH_TEXT_PARAGRAPH_GAP = 2;

export type WrappedRichLine = {
  runs: RichTextRun[];
  /** Distance to the next line, as a multiple of lineHeight. */
  gapAfter: number;
};

const leftInkInsetCache = new Map<string, number>();

/** First visible character after Markdown, for optical left-edge alignment. */
export function firstPlainChar(input: string): string {
  const plain = stripMarkdown(input).replace(/^\s+/u, "");
  if (!plain) return "";
  return [...plain][0] ?? "";
}

/**
 * Distance from fillText's x origin to the first ink pixel of `text`.
 * Positive means the glyph starts to the right of the origin (side bearing).
 */
export function measureLeftInkInset(
  ctx: CanvasRenderingContext2D,
  text: string,
  fontSize: number,
  fontWeight = "400",
  fontFamily = "Roboto, system-ui, sans-serif",
): number {
  const ch = firstPlainChar(text);
  if (!ch || fontSize <= 0) return 0;

  if (typeof document === "undefined") {
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    const left = ctx.measureText(ch).actualBoundingBoxLeft;
    return Number.isFinite(left) ? -left : 0;
  }

  const key = `${fontFamily}\0${fontWeight}\0${fontSize.toFixed(2)}\0${ch}`;
  const cached = leftInkInsetCache.get(key);
  if (cached != null) return cached;

  const origin = Math.ceil(fontSize);
  const w = Math.max(8, origin * 3);
  const h = Math.max(8, origin * 3);
  const probe = document.createElement("canvas");
  probe.width = w;
  probe.height = h;
  const probeCtx = probe.getContext("2d", { willReadFrequently: true });
  if (!probeCtx) return 0;
  probeCtx.clearRect(0, 0, w, h);
  probeCtx.fillStyle = "#000";
  probeCtx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  probeCtx.textBaseline = "top";
  probeCtx.textAlign = "left";
  probeCtx.fillText(ch, origin, origin);
  const { data } = probeCtx.getImageData(0, 0, w, h);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      if (data[(y * w + x) * 4 + 3] > 8) {
        const inset = x - origin;
        leftInkInsetCache.set(key, inset);
        return inset;
      }
    }
  }
  leftInkInsetCache.set(key, 0);
  return 0;
}

/** Plain text for previews and filenames. */
export function stripMarkdown(input: string): string {
  return input
    .replace(/\[\[(.+?)\]\]/g, "$1")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/(?<![A-Za-z0-9])_(.+?)_(?![A-Za-z0-9])/g, "$1");
}

type RunStyle = Pick<RichTextRun, "bold" | "italic" | "highlight">;

function runsShareStyle(a: RichTextRun, b: RunStyle): boolean {
  return (
    !!a.bold === !!b.bold &&
    !!a.italic === !!b.italic &&
    !!a.highlight === !!b.highlight
  );
}

function pushRun(runs: RichTextRun[], text: string, style: RunStyle = {}) {
  if (!text) return;
  const last = runs[runs.length - 1];
  if (last && runsShareStyle(last, style)) {
    last.text += text;
    return;
  }
  runs.push({ text, ...style });
}

function findNextMarker(input: string, from: number): number {
  let next = input.length;
  for (const marker of ["[[", "**", "__", "*", "_"]) {
    const idx = input.indexOf(marker, from);
    if (idx !== -1) next = Math.min(next, idx);
  }
  return next;
}

/**
 * Parse inline Markdown-style formatting for canvas text.
 *
 * - `**text**` — bold + VDID blue (legacy highlight)
 * - `__text__` — bold
 * - `*text*` / `_text_` — italic
 * - `[[text]]` — VDID blue without extra bold
 */
export function parseRichText(input: string): RichTextRun[] {
  const runs: RichTextRun[] = [];
  let i = 0;

  while (i < input.length) {
    if (input.startsWith("[[", i)) {
      const end = input.indexOf("]]", i + 2);
      if (end !== -1) {
        pushRun(runs, input.slice(i + 2, end), { highlight: true });
        i = end + 2;
        continue;
      }
    }

    if (input.startsWith("**", i)) {
      const end = input.indexOf("**", i + 2);
      if (end !== -1) {
        pushRun(runs, input.slice(i + 2, end), { bold: true, highlight: true });
        i = end + 2;
        continue;
      }
    }

    if (input.startsWith("__", i)) {
      const end = input.indexOf("__", i + 2);
      if (end !== -1) {
        pushRun(runs, input.slice(i + 2, end), { bold: true });
        i = end + 2;
        continue;
      }
    }

    if (input[i] === "*" && input[i + 1] !== "*") {
      const end = input.indexOf("*", i + 1);
      if (end !== -1 && input[end + 1] !== "*") {
        pushRun(runs, input.slice(i + 1, end), { italic: true });
        i = end + 1;
        continue;
      }
    }

    if (input[i] === "_" && input[i + 1] !== "_") {
      const end = input.indexOf("_", i + 1);
      if (end !== -1 && input[end + 1] !== "_") {
        const prev = i === 0 ? "" : input[i - 1];
        const next = end + 1 >= input.length ? "" : input[end + 1];
        if (!/[A-Za-z0-9]/.test(prev) && !/[A-Za-z0-9]/.test(next)) {
          pushRun(runs, input.slice(i + 1, end), { italic: true });
          i = end + 1;
          continue;
        }
      }
    }

    const next = findNextMarker(input, i + 1);
    pushRun(runs, input.slice(i, next));
    i = next;
  }

  if (runs.length === 0 && input.length > 0) {
    runs.push({ text: input });
  }

  return runs;
}

function runFont(
  run: RichTextRun,
  fontSize: number,
  fontWeight: string,
  fontFamily: string,
): string {
  const weight = run.bold ? "700" : fontWeight;
  const style = run.italic ? "italic " : "";
  return `${style}${weight} ${fontSize}px ${fontFamily}`;
}

function measureRunWidth(
  ctx: CanvasRenderingContext2D,
  run: RichTextRun,
  fontSize: number,
  fontWeight: string,
  fontFamily: string,
): number {
  ctx.font = runFont(run, fontSize, fontWeight, fontFamily);
  return ctx.measureText(run.text).width;
}

function measureLineWidth(
  ctx: CanvasRenderingContext2D,
  line: RichTextLine,
  fontSize: number,
  fontWeight: string,
  fontFamily: string,
): number {
  return line.reduce(
    (sum, run) => sum + measureRunWidth(ctx, run, fontSize, fontWeight, fontFamily),
    0,
  );
}

function gapForNewlines(count: number) {
  if (count <= 1) return RICH_TEXT_RETURN_GAP;
  return count === 2 ? RICH_TEXT_PARAGRAPH_GAP : count;
}

function trimTrailingSpaces(line: RichTextRun[]) {
  while (line.length > 0) {
    const last = line[line.length - 1];
    const trimmed = last.text.replace(/\s+$/u, "");
    if (trimmed.length === last.text.length) break;
    if (!trimmed) line.pop();
    else last.text = trimmed;
  }
}

function appendRun(
  line: RichTextRun[],
  style: RunStyle,
  text: string,
) {
  const last = line[line.length - 1];
  if (last && runsShareStyle(last, style)) {
    last.text += text;
    return;
  }
  line.push({ text, ...style });
}

/**
 * Wrap rich text runs into lines that fit within maxWidth.
 * Auto-wrap never starts a line with a space.
 * `\\n` is a normal Return (same gap as wrap), `\\n`+ZWSP is a Soft Return,
 * `\\n\\n` is a blank line.
 */
export function wrapRichText(
  ctx: CanvasRenderingContext2D,
  runs: RichTextRun[],
  maxWidth: number,
  fontSize: number,
  fontWeight = "400",
  fontFamily = "Roboto, system-ui, sans-serif",
): WrappedRichLine[] {
  const lines: WrappedRichLine[] = [];
  let currentLine: RichTextRun[] = [];
  let currentWidth = 0;

  const flush = (gapAfter: number, trimWrapSpace: boolean) => {
    if (trimWrapSpace) trimTrailingSpaces(currentLine);
    lines.push({ runs: currentLine, gapAfter });
    currentLine = [];
    currentWidth = 0;
  };

  const addWord = (style: RunStyle, word: string) => {
    const isSpace = /^\s+$/u.test(word);
    if ((isSpace || /^[\u200B]+$/u.test(word)) && currentLine.length === 0) {
      return;
    }
    if (word.startsWith("\u200B") && currentLine.length === 0) {
      word = word.replace(/^[\u200B]+/u, "");
      if (!word) return;
    }

    const testRun: RichTextRun = { text: word, ...style };
    const wordWidth = measureRunWidth(
      ctx,
      testRun,
      fontSize,
      fontWeight,
      fontFamily,
    );

    if (currentWidth + wordWidth > maxWidth && currentLine.length > 0) {
      flush(RICH_TEXT_WRAP_GAP, true);
      if (isSpace) return;
    }

    if (wordWidth > maxWidth && currentLine.length === 0 && !isSpace) {
      let remaining = word;
      while (remaining.length > 0) {
        let chunk = remaining;
        while (
          chunk.length > 1 &&
          measureRunWidth(
            ctx,
            { ...testRun, text: chunk },
            fontSize,
            fontWeight,
            fontFamily,
          ) > maxWidth
        ) {
          chunk = chunk.slice(0, -1);
        }
        remaining = remaining.slice(chunk.length);
        if (remaining.length > 0) {
          lines.push({
            runs: [{ ...testRun, text: chunk }],
            gapAfter: RICH_TEXT_WRAP_GAP,
          });
        } else {
          appendRun(currentLine, style, chunk);
          currentWidth = measureRunWidth(
            ctx,
            { ...testRun, text: chunk },
            fontSize,
            fontWeight,
            fontFamily,
          );
        }
      }
      return;
    }

    appendRun(currentLine, style, word);
    currentWidth += wordWidth;
  };

  for (const run of runs) {
    const style: RunStyle = {
      bold: run.bold,
      italic: run.italic,
      highlight: run.highlight,
    };
    const parts = run.text.split(/(\n\u200B|\u2028|\n+)/);

    for (const part of parts) {
      if (!part) continue;
      if (part === SOFT_RETURN || part === "\u2028") {
        flush(RICH_TEXT_SOFT_BREAK_GAP, false);
        continue;
      }
      if (part[0] === "\n") {
        flush(gapForNewlines(part.length), false);
        continue;
      }
      for (const word of part.split(/(\s+)/)) {
        if (!word) continue;
        addWord(style, word);
      }
    }
  }

  if (currentLine.length > 0 || lines.length === 0) {
    flush(RICH_TEXT_WRAP_GAP, false);
  }
  return lines;
}

/**
 * Draw rich text with optional Markdown formatting. Returns total height drawn.
 */
export function drawRichText(
  ctx: CanvasRenderingContext2D,
  text: string,
  options: DrawRichTextOptions,
): number {
  const {
    x,
    y,
    maxWidth,
    fontSize,
    fontWeight = "400",
    lineHeight = fontSize * 1.25,
    baseColor = "#1A1A1A",
    highlightColor = "#0A2CD9",
    fontFamily = "Roboto, system-ui, sans-serif",
    textAlign = "left",
  } = options;

  const runs = parseRichText(text);
  if (runs.length === 0) return 0;

  const lines = wrapRichText(
    ctx,
    runs,
    maxWidth,
    fontSize,
    fontWeight,
    fontFamily,
  );

  ctx.textBaseline = "top";
  ctx.textAlign = "left";

  let cy = y;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineWidth = measureLineWidth(
      ctx,
      line.runs,
      fontSize,
      fontWeight,
      fontFamily,
    );
    let cx = textAlign === "right" ? x - lineWidth : x;

    for (const run of line.runs) {
      ctx.fillStyle = run.highlight ? highlightColor : baseColor;
      ctx.font = runFont(run, fontSize, fontWeight, fontFamily);
      ctx.fillText(run.text, cx, cy);
      cx += ctx.measureText(run.text).width;
    }
    const gap = i < lines.length - 1 ? line.gapAfter : 1;
    cy += lineHeight * gap;
  }

  return cy - y;
}

/**
 * Measure total height of rich text without drawing.
 */
export function measureRichTextHeight(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  fontSize: number,
  fontWeight = "400",
  lineHeight?: number,
  fontFamily = "Roboto, system-ui, sans-serif",
): number {
  const lh = lineHeight ?? fontSize * 1.25;
  const runs = parseRichText(text);
  if (runs.length === 0) return 0;
  const lines = wrapRichText(
    ctx,
    runs,
    maxWidth,
    fontSize,
    fontWeight,
    fontFamily,
  );
  let height = 0;
  for (let i = 0; i < lines.length; i++) {
    const gap = i < lines.length - 1 ? lines[i].gapAfter : 1;
    height += lh * gap;
  }
  return height;
}

export function countRichTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  fontSize: number,
  fontWeight = "400",
  fontFamily = "Roboto, system-ui, sans-serif",
): number {
  const runs = parseRichText(text);
  if (runs.length === 0) return 0;
  return wrapRichText(
    ctx,
    runs,
    maxWidth,
    fontSize,
    fontWeight,
    fontFamily,
  ).length;
}

export function applyCanvasEnterKey(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  shiftKey: boolean,
): { value: string; caret: number } {
  const insert = shiftKey ? SOFT_RETURN : "\n";
  const start = Math.max(0, selectionStart);
  const end = Math.max(start, selectionEnd);
  return {
    value: value.slice(0, start) + insert + value.slice(end),
    caret: start + insert.length,
  };
}

export const FIT_TEXT_MIN_RATIO = 0.55;
export const FIT_TEXT_GROW_RATIO = 1.7;

export type FitRichTextFontSizeOptions = {
  maxWidth: number;
  maxHeight: number;
  maxFontSize: number;
  minFontSize?: number;
  fontWeight?: string;
  lineHeightRatio?: number;
  fontFamily?: string;
  /** Max scale-up relative to maxFontSize for short text (default 1.7). */
  growRatio?: number;
};

/**
 * Pick a font size that uses available height: grows for short text, shrinks when
 * content would overflow maxHeight.
 */
export function fitRichTextFontSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  options: FitRichTextFontSizeOptions,
): number {
  const {
    maxWidth,
    maxHeight,
    maxFontSize,
    minFontSize = maxFontSize * FIT_TEXT_MIN_RATIO,
    fontWeight = "400",
    lineHeightRatio = 1.25,
    fontFamily = "Roboto, system-ui, sans-serif",
    growRatio = FIT_TEXT_GROW_RATIO,
  } = options;

  if (!text.trim() || maxHeight <= 0) return maxFontSize;

  const heightAt = (size: number) =>
    measureRichTextHeight(
      ctx,
      text,
      maxWidth,
      size,
      fontWeight,
      size * lineHeightRatio,
      fontFamily,
    );

  let size = maxFontSize;
  const floor = Math.max(8, Math.round(minFontSize));

  while (size > floor && heightAt(size) > maxHeight) {
    size -= 1;
  }

  const ceiling = Math.round(maxFontSize * growRatio);
  while (size < ceiling && heightAt(size + 1) <= maxHeight) {
    size += 1;
  }

  return size;
}

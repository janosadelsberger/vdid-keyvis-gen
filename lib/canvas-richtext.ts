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

/**
 * Wrap rich text runs into lines that fit within maxWidth.
 */
export function wrapRichText(
  ctx: CanvasRenderingContext2D,
  runs: RichTextRun[],
  maxWidth: number,
  fontSize: number,
  fontWeight = "400",
  fontFamily = "Roboto, system-ui, sans-serif",
): RichTextLine[] {
  const lines: RichTextLine[] = [];
  let currentLine: RichTextRun[] = [];
  let currentWidth = 0;

  const pushLine = () => {
    if (currentLine.length > 0) {
      lines.push(currentLine);
      currentLine = [];
      currentWidth = 0;
    }
  };

  for (const run of runs) {
    const paragraphs = run.text.split("\n");

    for (let p = 0; p < paragraphs.length; p++) {
      if (p > 0) {
        pushLine();
      }

      const words = paragraphs[p].split(/(\s+)/);

      for (const word of words) {
        if (!word) continue;

        const testRun: RichTextRun = {
          text: word,
          bold: run.bold,
          italic: run.italic,
          highlight: run.highlight,
        };
        const wordWidth = measureRunWidth(
          ctx,
          testRun,
          fontSize,
          fontWeight,
          fontFamily,
        );

        if (currentWidth + wordWidth > maxWidth && currentWidth > 0) {
          pushLine();
        }

        if (wordWidth > maxWidth && currentLine.length === 0) {
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
            lines.push([{ ...testRun, text: chunk }]);
            remaining = remaining.slice(chunk.length);
          }
          currentWidth = 0;
          continue;
        }

        const last = currentLine[currentLine.length - 1];
        if (last && runsShareStyle(last, testRun)) {
          last.text += word;
        } else {
          currentLine.push({ ...testRun });
        }
        currentWidth += wordWidth;
      }
    }
  }

  pushLine();
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
  for (const line of lines) {
    const lineWidth = measureLineWidth(
      ctx,
      line,
      fontSize,
      fontWeight,
      fontFamily,
    );
    let cx = textAlign === "right" ? x - lineWidth : x;

    for (const run of line) {
      ctx.fillStyle = run.highlight ? highlightColor : baseColor;
      ctx.font = runFont(run, fontSize, fontWeight, fontFamily);
      ctx.fillText(run.text, cx, cy);
      cx += ctx.measureText(run.text).width;
    }
    cy += lineHeight;
  }

  return lines.length * lineHeight;
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
  return lines.length * lh;
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

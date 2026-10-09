import type {
  CustomSlideContent,
  CustomTemplate,
  NormalizedBox,
  PartnerLogoTemplateElement,
  TextTemplateElement,
} from "@/lib/custom-template";

/** Wordmark-wide enough that a half-column would squash it. */
const WIDE_ASPECT = 1.8;
const SAMPLE_ASPECT = 1.3;

export type PartnerLayoutCell = {
  logo: NormalizedBox;
  label: NormalizedBox;
};

function unionBoxes(boxes: NormalizedBox[]): NormalizedBox {
  const left = Math.min(...boxes.map((b) => b.x));
  const top = Math.min(...boxes.map((b) => b.y));
  const right = Math.max(...boxes.map((b) => b.x + b.w));
  const bottom = Math.max(...boxes.map((b) => b.y + b.h));
  return { x: left, y: top, w: right - left, h: bottom - top };
}

function fitAspect(aspect: number, maxW: number, maxH: number) {
  const safe = Math.max(aspect, 0.2);
  const wFromH = maxH * safe;
  if (wFromH <= maxW) return { w: wFromH, h: maxH };
  return { w: maxW, h: maxW / safe };
}

function cell(
  x: number,
  y: number,
  w: number,
  h: number,
  labelH: number,
  labelGap: number,
): PartnerLayoutCell {
  if (labelH <= 0) {
    return {
      logo: { x, y, w, h },
      label: { x, y: y + h, w, h: 0.001 },
    };
  }
  const logoH = Math.max(0.04, h - labelH - labelGap);
  return {
    logo: { x, y, w, h: logoH },
    label: { x, y: y + logoH + labelGap, w, h: labelH },
  };
}

function shouldStackPair(aspects: number[]) {
  const max = Math.max(...aspects);
  const mean = aspects.reduce((a, b) => a + b, 0) / aspects.length;
  return max >= 2 || mean >= WIDE_ASPECT;
}

function offsetCells(
  cells: PartnerLayoutCell[],
  dx: number,
  dy: number,
): PartnerLayoutCell[] {
  return cells.map((item) => ({
    logo: {
      ...item.logo,
      x: item.logo.x + dx,
      y: item.logo.y + dy,
    },
    label: {
      ...item.label,
      x: item.label.x + dx,
      y: item.label.y + dy,
    },
  }));
}

function centerCluster(cells: PartnerLayoutCell[], area: NormalizedBox) {
  const boxes = cells.flatMap((item) => [item.logo, item.label]);
  const bounds = unionBoxes(boxes);
  const dx = area.x + (area.w - bounds.w) / 2 - bounds.x;
  const dy = area.y + (area.h - bounds.h) / 2 - bounds.y;
  return offsetCells(cells, dx, dy);
}

export function layoutPartnerLogos(
  aspects: number[],
  area: NormalizedBox,
  options?: { reserveLabels?: boolean },
): PartnerLayoutCell[] {
  const n = Math.min(3, aspects.length);
  if (n === 0) return [];
  const labelH = options?.reserveLabels ? 0.048 : 0;
  const labelGap = options?.reserveLabels ? 0.012 : 0;
  const labelBand = labelH + labelGap;
  const gapX = Math.min(0.05, area.w * 0.08);
  const gapY = Math.min(0.04, area.h * 0.08);
  const used = aspects.slice(0, n);

  if (n === 1) {
    const wide = used[0] >= WIDE_ASPECT;
    const fitted = fitAspect(
      used[0],
      area.w * (wide ? 0.88 : 0.58),
      area.h * 0.72 - labelBand,
    );
    return centerCluster(
      [cell(0, 0, fitted.w, fitted.h + labelBand, labelH, labelGap)],
      area,
    );
  }

  if (n === 2) {
    if (shouldStackPair(used)) {
      const maxLogoH = (area.h - gapY) / 2 - labelBand;
      const sizes = used.map((aspect) =>
        fitAspect(aspect, area.w * 0.9, Math.max(0.08, maxLogoH)),
      );
      const cellW = Math.max(...sizes.map((s) => s.w));
      const cells = sizes.map((size, i) => {
        const y =
          i === 0 ? 0 : sizes[0].h + labelBand + gapY;
        return cell(0, y, cellW, size.h + labelBand, labelH, labelGap);
      });
      return centerCluster(cells, area);
    }
    const cellW = (area.w - gapX) / 2;
    const maxLogoH = area.h * 0.78 - labelBand;
    const sizes = used.map((aspect) =>
      fitAspect(aspect, cellW, Math.max(0.08, maxLogoH)),
    );
    const logoH = Math.max(...sizes.map((s) => s.h));
    const cellH = logoH + labelBand;
    return centerCluster(
      [
        cell(0, 0, cellW, cellH, labelH, labelGap),
        cell(cellW + gapX, 0, cellW, cellH, labelH, labelGap),
      ],
      area,
    );
  }

  if (used.every((aspect) => aspect >= WIDE_ASPECT)) {
    const maxLogoH = (area.h - 2 * gapY) / 3 - labelBand;
    const sizes = used.map((aspect) =>
      fitAspect(aspect, area.w * 0.9, Math.max(0.06, maxLogoH)),
    );
    const cellW = Math.max(...sizes.map((s) => s.w));
    let y = 0;
    const cells = sizes.map((size) => {
      const item = cell(0, y, cellW, size.h + labelBand, labelH, labelGap);
      y += size.h + labelBand + gapY;
      return item;
    });
    return centerCluster(cells, area);
  }

  const cellW = (area.w - gapX) / 2;
  const maxLogoH = (area.h - gapY) / 2 - labelBand;
  const sizes = used.map((aspect) =>
    fitAspect(aspect, cellW, Math.max(0.08, maxLogoH)),
  );
  const topH = Math.max(sizes[0].h, sizes[1].h) + labelBand;
  const botH = sizes[2].h + labelBand;
  return centerCluster(
    [
      cell(0, 0, cellW, topH, labelH, labelGap),
      cell(cellW + gapX, 0, cellW, topH, labelH, labelGap),
      cell((cellW + gapX) / 2, topH + gapY, cellW, botH, labelH, labelGap),
    ],
    area,
  );
}

type SizedImage = {
  width: number;
  height: number;
  naturalWidth?: number;
  naturalHeight?: number;
};

function imageAspect(img: SizedImage | null | undefined): number {
  if (!img) return SAMPLE_ASPECT;
  const w = img.naturalWidth || img.width || 0;
  const h = img.naturalHeight || img.height || 0;
  if (w <= 0 || h <= 0) return SAMPLE_ASPECT;
  return w / h;
}

function labelFieldForSlot(slot: string) {
  if (slot === "partner2") return "partnerLabel2";
  if (slot === "partner3") return "partnerLabel3";
  return "partnerLabel1";
}

export function partnerAutoLayoutBoxes(
  template: CustomTemplate,
  content: CustomSlideContent,
  images: Map<string, SizedImage>,
  sampleMode: boolean,
): Map<string, NormalizedBox> | null {
  const logos = template.elements.filter(
    (el): el is PartnerLogoTemplateElement => el.kind === "partnerLogo",
  );
  if (logos.length < 2) return null;

  const labels = template.elements.filter(
    (el): el is TextTemplateElement =>
      el.kind === "text" && el.field.startsWith("partnerLabel"),
  );

  const filled = logos.flatMap((el) => {
    const url = content.images[el.slot]?.url ?? null;
    const img = url ? images.get(url) ?? null : null;
    const present = sampleMode || !!img;
    if (!present) return [];
    const field = labelFieldForSlot(el.slot);
    return [
      {
        el,
        label: labels.find((item) => item.field === field),
        aspect: imageAspect(img),
      },
    ];
  });
  if (filled.length === 0) return null;

  const area = unionBoxes([
    ...logos.map((el) => el.box),
    ...labels.map((el) => el.box),
  ]);
  const reserveLabels = filled.some((item) => {
    if (!item.label || sampleMode) return false;
    return Boolean((content.fields[item.label.field] ?? "").trim());
  });
  const cells = layoutPartnerLogos(
    filled.map((item) => item.aspect),
    area,
    { reserveLabels },
  );
  const boxes = new Map<string, NormalizedBox>();
  filled.forEach((item, i) => {
    const cellBox = cells[i];
    if (!cellBox) return;
    boxes.set(item.el.id, cellBox.logo);
    if (item.label) boxes.set(item.label.id, cellBox.label);
  });
  return boxes;
}

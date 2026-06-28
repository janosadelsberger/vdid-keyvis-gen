import { publicFile } from "@/lib/public-file";

const logoCache = new Map<string, Promise<HTMLImageElement>>();

async function loadLogoSvg(recolorWhiteTo?: string): Promise<HTMLImageElement> {
  const url = publicFile("/VDID_Logo_neg.svg");
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch logo: ${url}`);
  }
  let svg = await res.text();
  if (recolorWhiteTo) {
    svg = svg.replace(/fill="#FFFFFF"/gi, `fill="${recolorWhiteTo}"`);
  }

  const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Failed to load logo"));
    img.src = dataUrl;
  });
  return img;
}

/**
 * Load `VDID_Logo_neg.svg` unchanged in layout; only white fills are recolored
 * (default `#1A1A1A`) for light backgrounds.
 */
export function loadRecoloredLogo(hex = "#1A1A1A"): Promise<HTMLImageElement> {
  const normalized = hex.toUpperCase();
  const cached = logoCache.get(normalized);
  if (cached) return cached;

  const promise = loadLogoSvg(normalized).catch((err) => {
    logoCache.delete(normalized);
    throw err;
  });

  logoCache.set(normalized, promise);
  return promise;
}

const WHITE_LOGO_CACHE_KEY = "__WHITE__";

/** Load `VDID_Logo_neg.svg` with original white fills — for dark backgrounds. */
export function loadWhiteLogo(): Promise<HTMLImageElement> {
  const cached = logoCache.get(WHITE_LOGO_CACHE_KEY);
  if (cached) return cached;

  const promise = loadLogoSvg().catch((err) => {
    logoCache.delete(WHITE_LOGO_CACHE_KEY);
    throw err;
  });

  logoCache.set(WHITE_LOGO_CACHE_KEY, promise);
  return promise;
}

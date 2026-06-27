import { publicFile } from "@/lib/public-file";

const logoCache = new Map<string, Promise<HTMLImageElement>>();

/**
 * Load `VDID_Logo_neg.svg` unchanged in layout; only white fills are recolored
 * (default `#1A1A1A`) for light backgrounds.
 */
export function loadRecoloredLogo(hex = "#1A1A1A"): Promise<HTMLImageElement> {
  const normalized = hex.toUpperCase();
  const cached = logoCache.get(normalized);
  if (cached) return cached;

  const promise = (async () => {
    const url = publicFile("/VDID_Logo_neg.svg");
    const res = await fetch(url);
    if (!res.ok) {
      logoCache.delete(normalized);
      throw new Error(`Failed to fetch logo: ${url}`);
    }
    let svg = await res.text();
    svg = svg.replace(/fill="#FFFFFF"/gi, `fill="${normalized}"`);

    const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => {
        logoCache.delete(normalized);
        reject(new Error("Failed to load recolored logo"));
      };
      img.src = dataUrl;
    });
    return img;
  })();

  logoCache.set(normalized, promise);
  return promise;
}

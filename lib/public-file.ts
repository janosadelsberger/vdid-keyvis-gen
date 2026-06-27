/**
 * Root-absolute URL for a file in `/public`.
 *
 * Uses `NEXT_PUBLIC_BASE_PATH` (from `next.config.mjs`) so assets resolve
 * correctly from any route — including nested pages like `/socials/`.
 *
 * - Dev: `/VDID_Logo_neg.svg`
 * - GitHub Pages: `/vdid-keyvis-gen/VDID_Logo_neg.svg`
 */
export function publicFile(path: string): string {
  const clean = path.replace(/^\//, "");
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  if (!base) return `/${clean}`;
  const normalizedBase = base.endsWith("/") ? base.slice(0, -1) : base;
  return `${normalizedBase}/${clean}`;
}

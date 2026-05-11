/**
 * URL for a file in `/public`.
 *
 * Uses a path **relative to the current page** (`./…`), so it works:
 * - locally (`/` → `/VDID_Logo_neg.svg`)
 * - on GitHub Pages with `basePath` (`/repo/` → `/repo/VDID_Logo_neg.svg`)
 *
 * Avoids relying on `NEXT_PUBLIC_BASE_PATH` being inlined identically everywhere.
 */
export function publicFile(path: string): string {
  const clean = path.replace(/^\//, "");
  return `./${clean}`;
}

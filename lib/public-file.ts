/**
 * URL for a file in `/public` when the app uses Next.js `basePath`
 * (e.g. GitHub Pages project sites at /repo-name/).
 */
export function publicFile(path: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

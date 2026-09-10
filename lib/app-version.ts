/** Public channel — also the URL prefix (`/beta/`). */
export const APP_CHANNEL = "beta";
export const APP_VERSION_LABEL = APP_CHANNEL;
export const APP_VERSION_PATH = `/${APP_CHANNEL}`;

const LEGACY_VERSION_PREFIXES = ["/3/beta"];

export function versionedPath(path = "/"): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  if (clean === APP_VERSION_PATH || clean.startsWith(`${APP_VERSION_PATH}/`)) {
    return clean.endsWith("/") ? clean : `${clean}/`;
  }
  if (clean === "/") return `${APP_VERSION_PATH}/`;
  return `${APP_VERSION_PATH}${clean.endsWith("/") ? clean : `${clean}/`}`;
}

export function unversionedPath(pathname: string): string {
  const withSlash = pathname.endsWith("/") ? pathname : `${pathname}/`;
  for (const prefix of [APP_VERSION_PATH, ...LEGACY_VERSION_PREFIXES]) {
    const withSep = `${prefix}/`;
    if (withSlash === withSep) return "/";
    if (withSlash.startsWith(withSep)) return withSlash.slice(prefix.length);
  }
  return withSlash;
}

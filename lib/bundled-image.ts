import { publicFile } from "@/lib/public-file";

export function loadPublicImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = publicFile(src);
  });
}

export async function loadBundledImages(
  srcs: string[],
): Promise<Map<string, HTMLImageElement>> {
  const entries = await Promise.all(
    srcs.map(async (src) => {
      try {
        return [src, await loadPublicImage(src)] as const;
      } catch {
        return null;
      }
    }),
  );
  const map = new Map<string, HTMLImageElement>();
  for (const entry of entries) {
    if (entry) map.set(entry[0], entry[1]);
  }
  return map;
}

function isQuickTimeSrc(src: string) {
  return /\.(mov|qt)(\?|$)/i.test(src);
}

async function publicVideoSrc(src: string): Promise<string> {
  const url = publicFile(src);
  if (!isQuickTimeSrc(src)) return url;
  // Chrome often rejects video/quicktime even when the file is H.264.
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load video: ${src}`);
  const blob = await res.blob();
  return URL.createObjectURL(new Blob([blob], { type: "video/mp4" }));
}

function waitForVideo(
  video: HTMLVideoElement,
  timeoutMs: number,
): Promise<HTMLVideoElement | null> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: HTMLVideoElement | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      video.removeEventListener("loadeddata", onReady);
      video.removeEventListener("canplay", onReady);
      video.removeEventListener("error", onError);
      resolve(result);
    };
    const onReady = () => finish(video);
    const onError = () => finish(null);
    const timer = window.setTimeout(onError, timeoutMs);
    video.addEventListener("loadeddata", onReady);
    video.addEventListener("canplay", onReady);
    video.addEventListener("error", onError);
  });
}

export async function probePublicVideo(
  candidates: readonly string[],
): Promise<HTMLVideoElement | null> {
  for (const src of candidates) {
    const video = document.createElement("video");
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = "auto";
    video.setAttribute("playsinline", "true");
    video.setAttribute("webkit-playsinline", "true");
    try {
      const url = await publicVideoSrc(src);
      const wait = waitForVideo(video, 4000);
      video.src = url;
      video.load();
      const ready = await wait;
      if (ready) return ready;
      if (url.startsWith("blob:")) URL.revokeObjectURL(url);
    } catch {
      // try the next candidate
    }
    video.removeAttribute("src");
    video.load();
  }
  return null;
}

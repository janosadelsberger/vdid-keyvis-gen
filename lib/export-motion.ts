import { applyPalette, GIFEncoder, quantize } from "gifenc";
import { ArrayBufferTarget, Muxer } from "mp4-muxer";

export const GIF_FPS = 10;
export const GIF_MAX_DURATION_S = 4;
export const VIDEO_FPS = 30;

export type MotionProgress = (done: number, total: number) => void;

function waitForSeek(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    const target = Math.min(
      Math.max(0, time),
      Math.max(0, duration > 0 ? duration - 0.001 : time),
    );
    if (Math.abs(video.currentTime - target) < 0.008) {
      resolve();
      return;
    }
    const onSeeked = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("Video seek failed"));
    };
    const cleanup = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
    };
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", onError);
    video.currentTime = target;
  });
}

export function motionDurationS(
  video: HTMLVideoElement,
  maxSeconds?: number,
): number {
  const duration = Number.isFinite(video.duration) ? video.duration : 0;
  const source = duration > 0 ? duration : GIF_MAX_DURATION_S;
  if (maxSeconds == null) return source;
  return Math.min(source, maxSeconds);
}

async function walkFrames(
  video: HTMLVideoElement,
  durationS: number,
  fps: number,
  onFrame: (index: number, total: number) => void | Promise<void>,
  onProgress?: MotionProgress,
) {
  const wasPaused = video.paused;
  video.pause();
  const total = Math.max(1, Math.round(durationS * fps));
  onProgress?.(0, total);
  for (let i = 0; i < total; i++) {
    await waitForSeek(video, (i / fps) % Math.max(durationS, 0.001));
    await onFrame(i, total);
    onProgress?.(i + 1, total);
  }
  if (!wasPaused) {
    void video.play().catch(() => undefined);
  }
}

export async function encodeSlideGif(options: {
  width: number;
  height: number;
  video: HTMLVideoElement;
  drawFrame: (ctx: CanvasRenderingContext2D) => void;
  onProgress?: MotionProgress;
}): Promise<Blob> {
  const { width, height, video, drawFrame, onProgress } = options;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas nicht verfügbar.");

  const durationS = motionDurationS(video, GIF_MAX_DURATION_S);
  const gif = GIFEncoder();
  const delay = Math.round(1000 / GIF_FPS);

  await walkFrames(
    video,
    durationS,
    GIF_FPS,
    () => {
      drawFrame(ctx);
      const { data } = ctx.getImageData(0, 0, width, height);
      const palette = quantize(data, 256);
      const index = applyPalette(data, palette);
      gif.writeFrame(index, width, height, { palette, delay, repeat: 0 });
    },
    onProgress,
  );

  gif.finish();
  const bytes = gif.bytes();
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy], { type: "image/gif" });
}

type MotionEncodeOptions = {
  width: number;
  height: number;
  video: HTMLVideoElement;
  drawFrame: (ctx: CanvasRenderingContext2D) => void;
  onProgress?: MotionProgress;
};

type AvcEncoderConfig = VideoEncoderConfig & {
  avc?: { format: "avc" | "annexb" };
  hardwareAcceleration?: "no-preference" | "prefer-hardware" | "prefer-software";
};

/** Level 4.1+ — Level 3.1 (`avc1.42001f`) cannot encode 1080p. */
const AVC_CODECS = [
  "avc1.640029",
  "avc1.4D0029",
  "avc1.640028",
  "avc1.4D0028",
  "avc1.420029",
  "avc1.420028",
] as const;

const MP4_RECORDER_TYPES = [
  'video/mp4;codecs="avc1.640029"',
  "video/mp4;codecs=avc1.640029",
  "video/mp4;codecs=avc1.4D0029",
  "video/mp4;codecs=avc1",
  "video/mp4",
];

function canUseWebCodecsMp4(): boolean {
  return (
    typeof VideoEncoder !== "undefined" &&
    typeof VideoFrame !== "undefined" &&
    typeof VideoEncoder.isConfigSupported === "function"
  );
}

function mp4Bitrate(width: number, height: number) {
  return Math.round(
    Math.min(12_000_000, Math.max(5_000_000, width * height * 4.5)),
  );
}

function createExportCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas nicht verfügbar.");
  return { canvas, ctx };
}

async function pickAvcEncoderConfig(
  width: number,
  height: number,
): Promise<AvcEncoderConfig> {
  const bitrate = mp4Bitrate(width, height);
  const accelerations = [
    "prefer-hardware",
    "prefer-software",
    "no-preference",
  ] as const;

  for (const hardwareAcceleration of accelerations) {
    for (const codec of AVC_CODECS) {
      const config: AvcEncoderConfig = {
        codec,
        width,
        height,
        bitrate,
        framerate: VIDEO_FPS,
        avc: { format: "avc" },
        hardwareAcceleration,
      };
      const support = await VideoEncoder.isConfigSupported(config);
      if (support.supported) {
        return {
          ...config,
          codec: support.config?.codec ?? codec,
          bitrate: support.config?.bitrate ?? bitrate,
          width,
          height,
          avc: { format: "avc" },
        };
      }
    }
  }

  throw new Error("H.264/MP4 wird in diesem Browser nicht unterstützt.");
}

async function waitForEncoderQueue(encoder: VideoEncoder, maxQueued = 4) {
  if (encoder.encodeQueueSize < maxQueued) return;
  await new Promise<void>((resolve) => {
    const onDequeue = () => {
      if (encoder.encodeQueueSize < maxQueued) {
        encoder.removeEventListener("dequeue", onDequeue);
        resolve();
      }
    };
    encoder.addEventListener("dequeue", onDequeue);
  });
}

async function encodeSlideMp4WebCodecs(
  options: MotionEncodeOptions,
): Promise<Blob> {
  const { width, height, video, drawFrame, onProgress } = options;
  const { canvas, ctx } = createExportCanvas(width, height);
  const config = await pickAvcEncoderConfig(width, height);

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: {
      codec: "avc",
      width,
      height,
      frameRate: VIDEO_FPS,
    },
    fastStart: "in-memory",
  });

  let encodeError: Error | null = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (err) => {
      encodeError = err instanceof Error ? err : new Error(String(err));
    },
  });
  try {
    encoder.configure(config);

    const durationS = motionDurationS(video);
    await walkFrames(
      video,
      durationS,
      VIDEO_FPS,
      async (index) => {
        if (encodeError) throw encodeError;
        drawFrame(ctx);
        await waitForEncoderQueue(encoder);
        const frame = new VideoFrame(canvas, {
          timestamp: Math.round((index * 1e6) / VIDEO_FPS),
          duration: Math.round(1e6 / VIDEO_FPS),
        });
        encoder.encode(frame, { keyFrame: index % VIDEO_FPS === 0 });
        frame.close();
      },
      onProgress,
    );

    if (encodeError) throw encodeError;
    await encoder.flush();
    if (encodeError) throw encodeError;
  } finally {
    if (encoder.state !== "closed") encoder.close();
  }

  muxer.finalize();
  const buffer = muxer.target.buffer;
  if (!buffer || buffer.byteLength < 32) {
    throw new Error("MP4-Datei ist leer.");
  }
  return new Blob([buffer], { type: "video/mp4" });
}

function pickMp4RecorderMime(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  return MP4_RECORDER_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) ?? null;
}

async function encodeSlideMp4Recorder(
  options: MotionEncodeOptions,
): Promise<Blob> {
  const mimeType = pickMp4RecorderMime();
  if (!mimeType) {
    throw new Error("H.264/MP4 wird in diesem Browser nicht unterstützt.");
  }

  const { width, height, video, drawFrame, onProgress } = options;
  const { canvas, ctx } = createExportCanvas(width, height);
  const stream = canvas.captureStream(VIDEO_FPS);
  const chunks: BlobPart[] = [];
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: mp4Bitrate(width, height),
  });
  const done = new Promise<Blob>((resolve, reject) => {
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onerror = () =>
      reject(new Error("MP4-Aufnahme fehlgeschlagen."));
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: "video/mp4" });
      if (blob.size < 32) {
        reject(new Error("MP4-Datei ist leer."));
        return;
      }
      resolve(blob);
    };
  });

  drawFrame(ctx);
  recorder.start(200);
  const durationS = motionDurationS(video);
  const frameMs = 1000 / VIDEO_FPS;
  await walkFrames(
    video,
    durationS,
    VIDEO_FPS,
    async () => {
      drawFrame(ctx);
      await new Promise((r) => window.setTimeout(r, frameMs));
    },
    onProgress,
  );
  await new Promise((r) => window.setTimeout(r, frameMs * 2));
  recorder.stop();
  return done;
}

export async function encodeSlideVideo(
  options: MotionEncodeOptions,
): Promise<Blob> {
  if (canUseWebCodecsMp4()) {
    try {
      return await encodeSlideMp4WebCodecs(options);
    } catch (err) {
      if (pickMp4RecorderMime()) {
        return encodeSlideMp4Recorder(options);
      }
      throw err;
    }
  }
  return encodeSlideMp4Recorder(options);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

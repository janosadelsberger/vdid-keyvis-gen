import {
  drawRichText,
  measureRichTextHeight,
  type DrawRichTextOptions,
} from "@/lib/canvas-richtext";

type HdrHeadlinePass = {
  text: string;
  options: DrawRichTextOptions;
  amount: number;
};

const GPU_TEXTURE_USAGE_COPY_DST = 0x02;
const GPU_TEXTURE_USAGE_TEXTURE_BINDING = 0x04;

type GpuCanvasContext = {
  configure: (descriptor: Record<string, unknown>) => void;
  getCurrentTexture: () => { createView: () => unknown };
};

type GpuDevice = {
  createShaderModule: (desc: { code: string }) => unknown;
  createRenderPipeline: (desc: Record<string, unknown>) => { getBindGroupLayout: (i: number) => unknown };
  createTexture: (desc: Record<string, unknown>) => {
    createView: () => unknown;
    destroy?: () => void;
  };
  createSampler: () => unknown;
  createBindGroup: (desc: Record<string, unknown>) => unknown;
  createCommandEncoder: () => {
    beginRenderPass: (desc: Record<string, unknown>) => {
      setPipeline: (pipeline: unknown) => void;
      setBindGroup: (index: number, group: unknown) => void;
      draw: (count: number) => void;
      end: () => void;
    };
    finish: () => unknown;
  };
  queue: {
    submit: (commands: unknown[]) => void;
    copyExternalImageToTexture: (
      source: { source: HTMLCanvasElement },
      dest: { texture: unknown },
      size: [number, number],
    ) => void;
  };
};

type GpuNavigator = Navigator & {
  gpu?: {
    requestAdapter: () => Promise<{ requestDevice: () => Promise<GpuDevice> } | null>;
  };
};

const SHADER = `
struct VsOut {
  @builtin(position) pos: vec4f,
  @location(0) uv: vec2f,
}

@vertex
fn vs(@builtin(vertex_index) i: u32) -> VsOut {
  var p = array<vec2f, 3>(
    vec2f(-1.0, -1.0),
    vec2f(3.0, -1.0),
    vec2f(-1.0, 3.0),
  );
  var uv = array<vec2f, 3>(
    vec2f(0.0, 1.0),
    vec2f(2.0, 1.0),
    vec2f(0.0, -1.0),
  );
  var out: VsOut;
  out.pos = vec4f(p[i], 0.0, 1.0);
  out.uv = uv[i];
  return out;
}

@group(0) @binding(0) var maskTex: texture_2d<f32>;
@group(0) @binding(1) var maskSamp: sampler;

@fragment
fn fs(in: VsOut) -> @location(0) vec4f {
  let texel = textureSample(maskTex, maskSamp, in.uv);
  let a = texel.a;
  if (a < 0.001) {
    return vec4f(0.0);
  }
  let v = 1.0 + 0.55 * texel.r;
  return vec4f(v * a, v * a, v * a, a);
}
`;

let devicePromise: Promise<GpuDevice | null> | null = null;
let pipeline: ReturnType<GpuDevice["createRenderPipeline"]> | null = null;
let sampler: unknown;

function requestGpuDevice() {
  if (!devicePromise) {
    devicePromise = (async () => {
      const gpu = (navigator as GpuNavigator).gpu;
      if (!gpu) return null;
      const adapter = await gpu.requestAdapter();
      if (!adapter) return null;
      try {
        return await adapter.requestDevice();
      } catch {
        return null;
      }
    })();
  }
  return devicePromise;
}

function gray(lift: number, alpha = 1) {
  const v = Math.round(Math.min(1, Math.max(0, lift)) * 255);
  return alpha < 1
    ? `rgba(${v}, ${v}, ${v}, ${alpha})`
    : `rgb(${v}, ${v}, ${v})`;
}

function paintLiftMask(
  ctx: CanvasRenderingContext2D,
  text: string,
  options: DrawRichTextOptions,
  amount: number,
) {
  const { x, y, maxWidth, fontSize, lineHeight = fontSize * 1.25 } = options;
  const height = measureRichTextHeight(
    ctx,
    text,
    maxWidth,
    fontSize,
    options.fontWeight,
    lineHeight,
    options.fontFamily,
  );
  if (height <= 0) return;

  const linear = ctx.createLinearGradient(x, y, x + maxWidth, y + height);
  linear.addColorStop(0, gray(0.18 * amount));
  linear.addColorStop(0.42, gray(0.7 * amount));
  linear.addColorStop(1, gray(0.28 * amount));
  ctx.fillStyle = linear;
  ctx.fillRect(x - 1, y - 1, maxWidth + 2, height + 2);

  const radius = Math.max(maxWidth, height) * 0.7;
  const spot = ctx.createRadialGradient(
    x + maxWidth * 0.28,
    y + height * 0.22,
    0,
    x + maxWidth * 0.28,
    y + height * 0.22,
    radius,
  );
  spot.addColorStop(0, gray(amount));
  spot.addColorStop(1, gray(0, 0));
  ctx.fillStyle = spot;
  ctx.fillRect(x - 1, y - 1, maxWidth + 2, height + 2);

  ctx.globalCompositeOperation = "destination-in";
  drawRichText(ctx, text, {
    ...options,
    baseColor: "#ffffff",
    highlightColor: "#ffffff",
  });
  ctx.globalCompositeOperation = "source-over";
}

function makeLiftAtlas(
  width: number,
  height: number,
  passes: HdrHeadlinePass[],
): HTMLCanvasElement | null {
  const atlas = document.createElement("canvas");
  atlas.width = Math.max(1, width);
  atlas.height = Math.max(1, height);
  const ctx = atlas.getContext("2d");
  if (!ctx) return null;
  ctx.clearRect(0, 0, atlas.width, atlas.height);
  for (const pass of passes) {
    ctx.save();
    try {
      paintLiftMask(ctx, pass.text, pass.options, pass.amount);
    } catch {
      /* skip */
    }
    ctx.restore();
  }
  return atlas;
}

export async function paintHdrHeadlinePassesWebgpu(
  canvas: HTMLCanvasElement,
  passes: HdrHeadlinePass[],
): Promise<boolean> {
  if (typeof navigator === "undefined" || passes.length === 0) return false;
  const device = await requestGpuDevice();
  if (!device) return false;

  const atlas = makeLiftAtlas(canvas.width, canvas.height, passes);
  if (!atlas) return false;

  let gpuCtx: GpuCanvasContext | null = null;
  try {
    gpuCtx = canvas.getContext("webgpu") as GpuCanvasContext | null;
  } catch {
    return false;
  }
  if (!gpuCtx) return false;

  try {
    gpuCtx.configure({
      device,
      format: "rgba16float",
      alphaMode: "premultiplied",
      colorSpace: "display-p3",
      toneMapping: { mode: "extended" },
    });
  } catch {
    try {
      gpuCtx.configure({
        device,
        format: "rgba16float",
        alphaMode: "premultiplied",
        toneMapping: { mode: "extended" },
      });
    } catch {
      return false;
    }
  }

  if (!pipeline) {
    const module = device.createShaderModule({ code: SHADER });
    try {
      pipeline = device.createRenderPipeline({
        layout: "auto",
        vertex: { module, entryPoint: "vs" },
        fragment: {
          module,
          entryPoint: "fs",
          targets: [
            {
              format: "rgba16float",
              blend: {
                color: {
                  srcFactor: "one",
                  dstFactor: "one-minus-src-alpha",
                  operation: "add",
                },
                alpha: {
                  srcFactor: "one",
                  dstFactor: "one-minus-src-alpha",
                  operation: "add",
                },
              },
            },
          ],
        },
      });
    } catch {
      pipeline = null;
      return false;
    }
    sampler = device.createSampler();
  }

  const texture = device.createTexture({
    size: [atlas.width, atlas.height],
    format: "rgba8unorm",
    usage: GPU_TEXTURE_USAGE_TEXTURE_BINDING | GPU_TEXTURE_USAGE_COPY_DST,
  });
  device.queue.copyExternalImageToTexture(
    { source: atlas },
    { texture },
    [atlas.width, atlas.height],
  );

  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: texture.createView() },
      { binding: 1, resource: sampler },
    ],
  });

  const encoder = device.createCommandEncoder();
  const pass = encoder.beginRenderPass({
    colorAttachments: [
      {
        view: gpuCtx.getCurrentTexture().createView(),
        clearValue: { r: 0, g: 0, b: 0, a: 0 },
        loadOp: "clear",
        storeOp: "store",
      },
    ],
  });
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.draw(3);
  pass.end();
  device.queue.submit([encoder.finish()]);
  texture.destroy?.();
  return true;
}

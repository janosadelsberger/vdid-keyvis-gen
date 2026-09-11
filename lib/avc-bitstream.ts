/** Annex-B / AVCC helpers for browsers that omit VideoEncoder decoderConfig (Firefox). */

function startCodeLength(data: Uint8Array, offset: number): number {
  if (
    offset + 2 < data.length &&
    data[offset] === 0 &&
    data[offset + 1] === 0 &&
    data[offset + 2] === 1
  ) {
    return 3;
  }
  if (
    offset + 3 < data.length &&
    data[offset] === 0 &&
    data[offset + 1] === 0 &&
    data[offset + 2] === 0 &&
    data[offset + 3] === 1
  ) {
    return 4;
  }
  return 0;
}

export function isAnnexB(data: Uint8Array): boolean {
  return startCodeLength(data, 0) > 0;
}

function copyNal(data: Uint8Array, start: number, end: number): Uint8Array {
  const nal = new Uint8Array(end - start);
  nal.set(data.subarray(start, end));
  return nal;
}

function splitAnnexB(data: Uint8Array): Uint8Array[] {
  const nals: Uint8Array[] = [];
  let i = 0;
  while (i < data.length) {
    const prefix = startCodeLength(data, i);
    if (!prefix) {
      i += 1;
      continue;
    }
    const start = i + prefix;
    let j = start;
    while (j < data.length && startCodeLength(data, j) === 0) j += 1;
    if (j > start) nals.push(copyNal(data, start, j));
    i = j;
  }
  return nals;
}

function splitAvcc(data: Uint8Array, littleEndian = false): Uint8Array[] {
  const nals: Uint8Array[] = [];
  let i = 0;
  while (i + 4 <= data.length) {
    const length = littleEndian
      ? (data[i] | (data[i + 1] << 8) | (data[i + 2] << 16) | (data[i + 3] << 24)) >>>
        0
      : ((data[i] << 24) | (data[i + 1] << 16) | (data[i + 2] << 8) | data[i + 3]) >>>
        0;
    i += 4;
    if (length <= 0 || i + length > data.length) return [];
    nals.push(copyNal(data, i, i + length));
    i += length;
  }
  return i === data.length ? nals : [];
}

function splitLengthPrefixed(data: Uint8Array): Uint8Array[] {
  const be = splitAvcc(data, false);
  if (be.length > 0) return be;
  return splitAvcc(data, true);
}

function annexBOffset(data: Uint8Array): number {
  const limit = Math.min(data.length - 3, 64);
  for (let i = 0; i <= limit; i++) {
    if (startCodeLength(data, i) > 0) return i;
  }
  return -1;
}

function nalType(nal: Uint8Array): number {
  return nal[0] & 0x1f;
}

function findSpsPps(nals: Uint8Array[]): { sps: Uint8Array; pps: Uint8Array } | null {
  const sps = nals.find((nal) => nal.length > 4 && nalType(nal) === 7);
  const pps = nals.find((nal) => nal.length > 1 && nalType(nal) === 8);
  if (!sps || !pps) return null;
  return { sps, pps };
}

function buildAvcDecoderRecord(sps: Uint8Array, pps: Uint8Array): Uint8Array {
  const out = new Uint8Array(11 + sps.length + pps.length);
  let o = 0;
  out[o++] = 1;
  out[o++] = sps[1];
  out[o++] = sps[2];
  out[o++] = sps[3];
  out[o++] = 0xff;
  out[o++] = 0xe1;
  out[o++] = (sps.length >> 8) & 0xff;
  out[o++] = sps.length & 0xff;
  out.set(sps, o);
  o += sps.length;
  out[o++] = 1;
  out[o++] = (pps.length >> 8) & 0xff;
  out[o++] = pps.length & 0xff;
  out.set(pps, o);
  return out;
}

function nalsToAvcc(nals: Uint8Array[]): Uint8Array {
  const kept = nals.filter((nal) => {
    const type = nalType(nal);
    return type !== 9 && type !== 12;
  });
  let size = 0;
  for (const nal of kept) size += 4 + nal.length;
  const out = new Uint8Array(size);
  let o = 0;
  for (const nal of kept) {
    out[o++] = (nal.length >>> 24) & 0xff;
    out[o++] = (nal.length >>> 16) & 0xff;
    out[o++] = (nal.length >>> 8) & 0xff;
    out[o++] = nal.length & 0xff;
    out.set(nal, o);
    o += nal.length;
  }
  return out;
}

function descriptionFromConfig(
  config: VideoDecoderConfig | undefined,
): Uint8Array | null {
  const description = config?.description;
  if (!description) return null;
  if (description instanceof ArrayBuffer) {
    return description.byteLength > 0 ? new Uint8Array(description) : null;
  }
  if (ArrayBuffer.isView(description)) {
    return description.byteLength > 0
      ? new Uint8Array(description.buffer, description.byteOffset, description.byteLength)
      : null;
  }
  return null;
}

export function hasAvcDescription(
  config: VideoDecoderConfig | null | undefined,
): boolean {
  return descriptionFromConfig(config ?? undefined) !== null;
}

export type PackedAvcChunk = {
  data: Uint8Array;
  decoderConfig: VideoDecoderConfig | null;
};

export function packAvcChunk(
  chunk: EncodedVideoChunk,
  meta: EncodedVideoChunkMetadata | undefined,
  previous: VideoDecoderConfig | null,
  fallbackCodec: string,
): PackedAvcChunk {
  const bytes = new Uint8Array(chunk.byteLength);
  chunk.copyTo(bytes);

  const fromMeta = meta?.decoderConfig;
  if (fromMeta && hasAvcDescription(fromMeta)) {
    return {
      data: isAnnexB(bytes) ? nalsToAvcc(splitAnnexB(bytes)) : bytes,
      decoderConfig: previous ?? fromMeta,
    };
  }

  const annexOffset = annexBOffset(bytes);
  const annexB = annexOffset === 0 || (annexOffset > 0 && !splitLengthPrefixed(bytes).length);
  const payload = annexOffset > 0 ? bytes.subarray(annexOffset) : bytes;
  const nals = annexB ? splitAnnexB(payload) : splitLengthPrefixed(bytes);
  const parameterSets = findSpsPps(nals);
  const data = annexB ? nalsToAvcc(nals) : nals.length ? nalsToAvcc(nals) : bytes;

  if (!parameterSets) {
    return { data, decoderConfig: previous };
  }

  const decoderConfig: VideoDecoderConfig = {
    codec: fromMeta?.codec ?? previous?.codec ?? fallbackCodec,
    codedWidth: fromMeta?.codedWidth ?? previous?.codedWidth,
    codedHeight: fromMeta?.codedHeight ?? previous?.codedHeight,
    description: buildAvcDecoderRecord(parameterSets.sps, parameterSets.pps),
    colorSpace: {
      primaries: "bt709",
      transfer: "bt709",
      matrix: "bt709",
      fullRange: false,
    },
  };
  return { data, decoderConfig: previous ?? decoderConfig };
}

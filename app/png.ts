const PNG_SIGNATURE_LENGTH = 8;

export function svgForPng(svg: string): string {
  // Rasterize module boundaries on the pixel grid. Smooth grey edge pixels
  // can prevent a narrow rMQR symbol from being detected at common print DPIs.
  return svg.replace("<svg ", '<svg shape-rendering="crispEdges" ');
}

// Bound allocation before creating a canvas, including on mobile browsers.
export function pngExportError(width: number, height: number): string | null {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0) {
    return "Choose a valid print size before exporting PNG.";
  }
  if (width > 8192 || height > 8192 || width * height > 16_000_000) {
    return "This PNG is too large. Lower the DPI or print size, or download SVG.";
  }
  return null;
}

function readUint32(bytes: Uint8Array, offset: number) {
  return (
    ((bytes[offset] << 24) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3]) >>>
    0
  );
}

function writeUint32(bytes: Uint8Array, offset: number, value: number) {
  bytes[offset] = (value >>> 24) & 0xff;
  bytes[offset + 1] = (value >>> 16) & 0xff;
  bytes[offset + 2] = (value >>> 8) & 0xff;
  bytes[offset + 3] = value & 0xff;
}

function chunkName(bytes: Uint8Array, offset: number) {
  return String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function densityChunk(dpi: number) {
  const chunk = new Uint8Array(21);
  writeUint32(chunk, 0, 9);
  chunk.set([0x70, 0x48, 0x59, 0x73], 4); // pHYs
  const pixelsPerMetre = Math.round(dpi / 0.0254);
  writeUint32(chunk, 8, pixelsPerMetre);
  writeUint32(chunk, 12, pixelsPerMetre);
  chunk[16] = 1;
  writeUint32(chunk, 17, crc32(chunk.slice(4, 17)));
  return chunk;
}

export function addPngDensity(source: Uint8Array, dpi: number) {
  const signature = source.slice(0, PNG_SIGNATURE_LENGTH);
  const chunks: Uint8Array[] = [signature];
  const physicalDensity = densityChunk(dpi);
  let offset = PNG_SIGNATURE_LENGTH;
  let inserted = false;

  while (offset + 12 <= source.length) {
    const dataLength = readUint32(source, offset);
    const totalLength = dataLength + 12;
    if (offset + totalLength > source.length) break;
    const name = chunkName(source, offset + 4);
    const chunk = source.slice(offset, offset + totalLength);

    if (name !== "pHYs") chunks.push(chunk);
    if (name === "IHDR" && !inserted) {
      chunks.push(physicalDensity);
      inserted = true;
    }
    offset += totalLength;
  }

  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(totalLength);
  let outputOffset = 0;
  for (const chunk of chunks) {
    output.set(chunk, outputOffset);
    outputOffset += chunk.length;
  }
  return output;
}

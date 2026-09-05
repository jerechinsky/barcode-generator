import bwipjs from "@bwip-js/browser";

export type BarcodeKind =
  | "qr"
  | "ean13"
  | "upca"
  | "ean8"
  | "itf14"
  | "code128"
  | "datamatrix"
  | "microqr"
  | "rmqr"
  | "aztec"
  | "pdf417";

export type SizePreset = "target" | "compact" | "custom";
export type Rotation = "N" | "R";
export type DataMatrixShape = "square" | "rectangle";
export type RmqrShape = "compact" | "low-profile";
export type RmqrMode = "auto" | "fit" | "exact";

export type BarcodeType = {
  id: BarcodeKind;
  label: string;
  shortLabel: string;
  family: "Matrix" | "Stacked" | "Linear";
  description: string;
  example: string;
  placeholder: string;
  linear: boolean;
  contentLabel: string;
  valueGroup: "portable2d" | BarcodeKind;
  multiline: boolean;
  rotatable: boolean;
};

const BARCODE_CATALOG: BarcodeType[] = [
  {
    id: "qr",
    label: "QR Code",
    shortLabel: "QR",
    family: "Matrix",
    description: "Best all-round choice for links and larger text payloads.",
    example: "https://example.com/product",
    placeholder: "Paste a URL or enter text",
    linear: false,
    contentLabel: "Text or URL",
    valueGroup: "portable2d",
    multiline: true,
    rotatable: false,
  },
  {
    id: "ean13",
    label: "EAN-13",
    shortLabel: "EAN-13",
    family: "Linear",
    description: "GTIN-13 for retail point-of-sale products.",
    example: "590123412345",
    placeholder: "12 or 13 digits",
    linear: true,
    contentLabel: "GTIN number",
    valueGroup: "ean13",
    multiline: false,
    rotatable: true,
  },
  {
    id: "upca",
    label: "UPC-A",
    shortLabel: "UPC-A",
    family: "Linear",
    description: "GTIN-12 for North American retail products.",
    example: "03600029145",
    placeholder: "11 or 12 digits",
    linear: true,
    contentLabel: "GTIN number",
    valueGroup: "upca",
    multiline: false,
    rotatable: true,
  },
  {
    id: "ean8",
    label: "EAN-8",
    shortLabel: "EAN-8",
    family: "Linear",
    description: "Compact retail symbol for assigned GTIN-8 numbers.",
    example: "9638507",
    placeholder: "7 or 8 digits",
    linear: true,
    contentLabel: "GTIN number",
    valueGroup: "ean8",
    multiline: false,
    rotatable: true,
  },
  {
    id: "itf14",
    label: "ITF-14",
    shortLabel: "ITF-14",
    family: "Linear",
    description: "GTIN-14 for outer cases. Not for retail checkout.",
    example: "1001234567890",
    placeholder: "13 or 14 digits",
    linear: true,
    contentLabel: "GTIN number",
    valueGroup: "itf14",
    multiline: false,
    rotatable: true,
  },
  {
    id: "code128",
    label: "Code 128",
    shortLabel: "Code 128",
    family: "Linear",
    description: "Dense linear code for part numbers and internal labels.",
    example: "PART-2026-0142",
    placeholder: "Enter a part number or text",
    linear: true,
    contentLabel: "Text or value",
    valueGroup: "code128",
    multiline: false,
    rotatable: true,
  },
  {
    id: "datamatrix",
    label: "Data Matrix",
    shortLabel: "Data Matrix",
    family: "Matrix",
    description: "Reliable compact matrix code for small labels and parts.",
    example: "LOT:A26-0813",
    placeholder: "Enter text, a lot code, or a URL",
    linear: false,
    contentLabel: "Text or URL",
    valueGroup: "portable2d",
    multiline: true,
    rotatable: true,
  },
  {
    id: "microqr",
    label: "Micro QR",
    shortLabel: "Micro QR",
    family: "Matrix",
    description: "Very small QR variant with more limited scanner support.",
    example: "A26-813",
    placeholder: "Enter a short payload",
    linear: false,
    contentLabel: "Short text or value",
    valueGroup: "portable2d",
    multiline: true,
    rotatable: false,
  },
  {
    id: "rmqr",
    label: "rMQR Code",
    shortLabel: "rMQR",
    family: "Matrix",
    description: "Rectangular QR variant for long, narrow spaces. Scanner support varies.",
    example: "https://example.com/product",
    placeholder: "Paste a URL or enter text",
    linear: false,
    contentLabel: "Text or URL",
    valueGroup: "portable2d",
    multiline: true,
    rotatable: true,
  },
  {
    id: "aztec",
    label: "Aztec Code",
    shortLabel: "Aztec",
    family: "Matrix",
    description: "Robust compact code used on tickets, passes, and travel documents.",
    example: "https://example.com/ticket/A26-813",
    placeholder: "Paste a URL or enter text",
    linear: false,
    contentLabel: "Text or URL",
    valueGroup: "portable2d",
    multiline: true,
    rotatable: false,
  },
  {
    id: "pdf417",
    label: "PDF417",
    shortLabel: "PDF417",
    family: "Stacked",
    description: "Wide stacked code for tickets, IDs, and document data.",
    example: "TICKET:A26-0813:SEAT-14",
    placeholder: "Enter ticket, ID, or document data",
    linear: false,
    contentLabel: "Text or document data",
    valueGroup: "portable2d",
    multiline: true,
    rotatable: true,
  },
];

const TYPE_ORDER: BarcodeKind[] = [
  "qr",
  "rmqr",
  "microqr",
  "datamatrix",
  "aztec",
  "pdf417",
  "ean13",
  "upca",
  "ean8",
  "itf14",
  "code128",
];

export const BARCODE_TYPES = TYPE_ORDER.map(
  (kind) => BARCODE_CATALOG.find((type) => type.id === kind)!,
);

export const PORTABLE_2D_KINDS = BARCODE_TYPES
  .filter((type) => type.valueGroup === "portable2d")
  .map((type) => type.id) as readonly BarcodeKind[];

type Guidance = {
  targetX: number;
  compactX: number;
  targetHeight?: number;
  compactHeight?: number;
  standard: string;
};

export const GUIDANCE: Record<BarcodeKind, Guidance> = {
  qr: {
    targetX: 0.495,
    compactX: 0.396,
    standard: "4-module quiet zone",
  },
  ean13: {
    targetX: 0.33,
    compactX: 0.264,
    targetHeight: 22.85,
    compactHeight: 18.28,
    standard: "11X left / 7X right quiet zones",
  },
  upca: {
    targetX: 0.33,
    compactX: 0.264,
    targetHeight: 22.85,
    compactHeight: 18.28,
    standard: "9X quiet zones on both sides",
  },
  ean8: {
    targetX: 0.33,
    compactX: 0.264,
    targetHeight: 18.23,
    compactHeight: 14.58,
    standard: "7X quiet zones on both sides",
  },
  itf14: {
    targetX: 0.635,
    compactX: 0.495,
    targetHeight: 31.75,
    compactHeight: 31.75,
    standard: "Bearer bars and 10X quiet zones",
  },
  code128: {
    targetX: 0.495,
    compactX: 0.33,
    targetHeight: 15,
    compactHeight: 10,
    standard: "10X quiet zones on both sides",
  },
  datamatrix: {
    targetX: 0.495,
    compactX: 0.396,
    standard: "1-module quiet zone",
  },
  microqr: {
    targetX: 0.4,
    compactX: 0.3,
    standard: "2-module quiet zone",
  },
  rmqr: {
    targetX: 0.4,
    compactX: 0.3,
    standard: "2-module quiet zone",
  },
  aztec: {
    targetX: 0.5,
    compactX: 0.33,
    standard: "No quiet zone required",
  },
  pdf417: {
    targetX: 0.33,
    compactX: 0.254,
    standard: "2X quiet zone and 3X row height",
  },
};

const NUMBER_RULES: Partial<
  Record<BarcodeKind, { base: number; total: number; name: string }>
> = {
  ean13: { base: 12, total: 13, name: "EAN-13" },
  upca: { base: 11, total: 12, name: "UPC-A" },
  ean8: { base: 7, total: 8, name: "EAN-8" },
  itf14: { base: 13, total: 14, name: "ITF-14" },
};

export function calculateGtinCheckDigit(base: string): string {
  const sum = [...base]
    .reverse()
    .reduce((total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 3 : 1), 0);
  return String((10 - (sum % 10)) % 10);
}

export type ValidationResult = {
  encoded: string;
  checkDigit?: string;
  generatedCheckDigit?: boolean;
  error?: string;
};

export function validateValue(kind: BarcodeKind, input: string): ValidationResult {
  if (input.length > 8192) {
    return { encoded: input, error: "This value is too long. Use at most 8,192 characters." };
  }
  const trimmedValue = input.trim();
  const rule = NUMBER_RULES[kind];

  if (!trimmedValue) return { encoded: "", error: "Enter something to encode." };

  if (rule) {
    const value = trimmedValue;
    if (!/^\d+$/.test(value)) {
      return { encoded: value, error: `${rule.name} accepts digits only.` };
    }
    if (value.length !== rule.base && value.length !== rule.total) {
      return {
        encoded: value,
        error: `${rule.name} needs ${rule.base} digits plus an automatic check digit, or all ${rule.total} digits.`,
      };
    }

    const base = value.slice(0, rule.base);
    const checkDigit = calculateGtinCheckDigit(base);
    if (value.length === rule.total && value.at(-1) !== checkDigit) {
      return {
        encoded: value,
        checkDigit,
        error: `Check digit should be ${checkDigit}, not ${value.at(-1)}.`,
      };
    }
    return {
      encoded: `${base}${checkDigit}`,
      checkDigit,
      generatedCheckDigit: value.length === rule.base,
    };
  }

  return { encoded: input };
}

export function isNumericKind(kind: BarcodeKind): boolean {
  return Boolean(NUMBER_RULES[kind]);
}

export type RenderInput = {
  kind: BarcodeKind;
  value: string;
  preset: SizePreset;
  customX: number;
  customHeight: number;
  targetWidth?: number;
  targetHeight?: number;
  barHeightOverride?: number;
  rotation: Rotation;
  includeText: boolean;
  errorCorrection: "L" | "M" | "Q" | "H";
  dataMatrixShape?: DataMatrixShape;
  rmqrShape?: RmqrShape;
  rmqrMode?: RmqrMode;
  rmqrVersion?: RmqrVersion;
  rmqrMaxWidth?: number;
  rmqrMaxHeight?: number;
  rmqrMinX?: number;
};

export type CapacityMode = "numeric" | "alphanumeric" | "byte";

export type BarcodeCapacity = {
  kind: "microqr";
  fits: boolean;
  used: number;
  maximum: number;
  remaining: number;
  overBy: number;
  unit: "digits" | "characters" | "bytes";
  mode: CapacityMode;
  requestedErrorCorrection: RenderInput["errorCorrection"];
  effectiveErrorCorrection: "L" | "M" | "Q";
  currentVersion?: "M1" | "M2" | "M3" | "M4";
  limitVersion: "M4";
  basis: "payload-specific";
  explanation: string;
};

const MICRO_QR_ALPHANUMERIC = /^[0-9A-Z $%*+\-./:]+$/;

function microQrMode(value: string): CapacityMode {
  if (value && /^\d+$/.test(value)) return "numeric";
  if (value && MICRO_QR_ALPHANUMERIC.test(value)) return "alphanumeric";
  return "byte";
}

function capacityUnits(value: string, mode: CapacityMode): number {
  return mode === "byte" ? new TextEncoder().encode(value).length : [...value].length;
}

function canEncodeMicroQr(value: string, errorCorrection: "L" | "M" | "Q") {
  try {
    const symbol = bwipjs.raw({
      bcid: "microqrcode",
      text: value,
      eclevel: errorCorrection,
      fixedeclevel: true,
    } as Parameters<typeof bwipjs.raw>[0])[0];
    return isMatrixRawSymbol(symbol) ? symbol : undefined;
  } catch {
    return undefined;
  }
}

function microQrVersionFromSize(size: number): BarcodeCapacity["currentVersion"] {
  if (size === 11) return "M1";
  if (size === 13) return "M2";
  if (size === 15) return "M3";
  if (size === 17) return "M4";
  return undefined;
}

/**
 * Returns payload-specific capacity information for Micro QR.
 *
 * QR capacity depends on the data modes and segment boundaries, not only the
 * JavaScript string length. To keep the result truthful for mixed payloads,
 * this asks the same encoder used for the export how many more same-class
 * units can be appended. For an oversized value, `overBy` is the number of
 * trailing units that must be removed before that exact prefix fits.
 */
export function analyzeBarcodeCapacity(input: Pick<RenderInput,
  "kind" | "value" | "errorCorrection"
>): BarcodeCapacity | undefined {
  if (input.kind !== "microqr") return undefined;

  const mode = microQrMode(input.value);
  const unit = mode === "numeric" ? "digits" : mode === "byte" ? "bytes" : "characters";
  const effectiveErrorCorrection = input.errorCorrection === "H" ? "Q" : input.errorCorrection;
  const used = capacityUnits(input.value, mode);
  const symbol = input.value
    ? canEncodeMicroQr(input.value, effectiveErrorCorrection)
    : undefined;
  const fits = Boolean(symbol);
  let maximum: number;

  if (fits || !input.value) {
    const suffix = mode === "numeric" ? "0" : mode === "alphanumeric" ? "A" : "a";
    let additional = 0;
    // M4 tops out at 35 numeric units. The guard keeps this calculation
    // bounded if a future encoder unexpectedly accepts a larger symbol.
    while (additional <= 35 && canEncodeMicroQr(
      `${input.value}${suffix.repeat(additional + 1)}`,
      effectiveErrorCorrection,
    )) {
      additional += 1;
    }
    maximum = used + additional;
  } else {
    const characters = [...input.value];
    let low = 0;
    let high = characters.length;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (canEncodeMicroQr(characters.slice(0, middle).join(""), effectiveErrorCorrection)) {
        low = middle;
      } else {
        high = middle - 1;
      }
    }
    maximum = capacityUnits(characters.slice(0, low).join(""), mode);
  }

  const remaining = fits ? Math.max(0, maximum - used) : 0;
  const overBy = fits ? 0 : Math.max(0, used - maximum);
  const explanation = mode === "numeric"
    ? "This payload uses Micro QR numeric encoding, which is its most compact mode."
    : mode === "alphanumeric"
      ? "This payload uses Micro QR's uppercase alphanumeric encoding."
      : "Lowercase letters and other characters outside Micro QR's numeric and uppercase alphanumeric set require byte encoding, which has less capacity.";

  return {
    kind: "microqr",
    fits,
    used,
    maximum,
    remaining,
    overBy,
    unit,
    mode,
    requestedErrorCorrection: input.errorCorrection,
    effectiveErrorCorrection,
    currentVersion: symbol ? microQrVersionFromSize(symbol.pixx) : undefined,
    limitVersion: "M4",
    basis: "payload-specific",
    explanation,
  };
}

export type RenderedBarcode = {
  svg: string;
  widthMm: number;
  heightMm: number;
  moduleCount?: number;
  moduleColumns?: number;
  moduleRows?: number;
  symbolVersion?: string;
  rmqrVersion?: RmqrVersion;
  xDimension: number;
  barHeight?: number;
  encoded: string;
};

const BCID: Record<BarcodeKind, string> = {
  qr: "qrcode",
  ean13: "ean13",
  upca: "upca",
  ean8: "ean8",
  itf14: "itf14",
  code128: "code128",
  datamatrix: "datamatrix",
  microqr: "microqrcode",
  rmqr: "rectangularmicroqrcode",
  aztec: "azteccode",
  pdf417: "pdf417",
};

const QUIET_ZONE_MODULES: Record<BarcodeKind, number> = {
  qr: 4,
  ean13: 0,
  upca: 0,
  ean8: 0,
  itf14: 0,
  code128: 10,
  datamatrix: 1,
  microqr: 2,
  rmqr: 2,
  aztec: 0,
  pdf417: 2,
};

const EAN_UPC_KINDS = new Set<BarcodeKind>(["ean13", "upca", "ean8"]);

export const RMQR_VERSIONS = [
  { id: "R7x43", rows: 7, columns: 43 },
  { id: "R7x59", rows: 7, columns: 59 },
  { id: "R7x77", rows: 7, columns: 77 },
  { id: "R7x99", rows: 7, columns: 99 },
  { id: "R7x139", rows: 7, columns: 139 },
  { id: "R9x43", rows: 9, columns: 43 },
  { id: "R9x59", rows: 9, columns: 59 },
  { id: "R9x77", rows: 9, columns: 77 },
  { id: "R9x99", rows: 9, columns: 99 },
  { id: "R9x139", rows: 9, columns: 139 },
  { id: "R11x27", rows: 11, columns: 27 },
  { id: "R11x43", rows: 11, columns: 43 },
  { id: "R11x59", rows: 11, columns: 59 },
  { id: "R11x77", rows: 11, columns: 77 },
  { id: "R11x99", rows: 11, columns: 99 },
  { id: "R11x139", rows: 11, columns: 139 },
  { id: "R13x27", rows: 13, columns: 27 },
  { id: "R13x43", rows: 13, columns: 43 },
  { id: "R13x59", rows: 13, columns: 59 },
  { id: "R13x77", rows: 13, columns: 77 },
  { id: "R13x99", rows: 13, columns: 99 },
  { id: "R13x139", rows: 13, columns: 139 },
  { id: "R15x43", rows: 15, columns: 43 },
  { id: "R15x59", rows: 15, columns: 59 },
  { id: "R15x77", rows: 15, columns: 77 },
  { id: "R15x99", rows: 15, columns: 99 },
  { id: "R15x139", rows: 15, columns: 139 },
  { id: "R17x43", rows: 17, columns: 43 },
  { id: "R17x59", rows: 17, columns: 59 },
  { id: "R17x77", rows: 17, columns: 77 },
  { id: "R17x99", rows: 17, columns: 99 },
  { id: "R17x139", rows: 17, columns: 139 },
] as const;

export type RmqrVersion = (typeof RMQR_VERSIONS)[number]["id"];
export type RmqrVersionMetadata = (typeof RMQR_VERSIONS)[number];

type MatrixRawSymbol = {
  pixs: number[];
  pixx: number;
  pixy: number;
  height: number;
  width: number;
};

type RmqrSelection = {
  version: RmqrVersion;
  symbol: MatrixRawSymbol;
  xDimension?: number;
};

function isMatrixRawSymbol(symbol: unknown): symbol is MatrixRawSymbol {
  return Boolean(
    symbol &&
    typeof symbol === "object" &&
    "pixx" in symbol &&
    "pixy" in symbol &&
    typeof symbol.pixx === "number" &&
    typeof symbol.pixy === "number",
  );
}

function encodeRmqrVersion(
  text: string,
  version: RmqrVersion,
  eclevel: "M" | "H",
): MatrixRawSymbol | undefined {
  try {
    const raw = bwipjs.raw({
      bcid: "rectangularmicroqrcode",
      text,
      version,
      eclevel,
    } as Parameters<typeof bwipjs.raw>[0]);
    return isMatrixRawSymbol(raw[0]) ? raw[0] : undefined;
  } catch {
    return undefined;
  }
}

function rmqrCandidates(text: string, eclevel: "M" | "H"): RmqrSelection[] {
  const candidates: RmqrSelection[] = [];

  for (const metadata of RMQR_VERSIONS) {
    const symbol = encodeRmqrVersion(text, metadata.id, eclevel);
    if (symbol) candidates.push({ version: metadata.id, symbol });
  }

  if (!candidates.length) {
    throw new Error(
      "This value does not fit in rMQR. Use QR Code, Data Matrix, Aztec, or PDF417 for a larger payload.",
    );
  }

  return candidates;
}

function chooseAutomaticRmqr(
  text: string,
  shape: RmqrShape,
  eclevel: "M" | "H",
): RmqrSelection {
  const candidates = rmqrCandidates(text, eclevel);

  candidates.sort((left, right) => {
    if (shape === "low-profile") {
      return left.symbol.pixy - right.symbol.pixy || left.symbol.pixx - right.symbol.pixx;
    }
    const leftArea = (left.symbol.pixx + 4) * (left.symbol.pixy + 4);
    const rightArea = (right.symbol.pixx + 4) * (right.symbol.pixy + 4);
    return leftArea - rightArea || left.symbol.pixy - right.symbol.pixy ||
      left.symbol.pixx - right.symbol.pixx;
  });

  return candidates[0];
}

function chooseExactRmqr(
  text: string,
  version: RmqrVersion | undefined,
  eclevel: "M" | "H",
): RmqrSelection {
  if (!version || !RMQR_VERSIONS.some((metadata) => metadata.id === version)) {
    throw new Error("Choose a valid exact rMQR version.");
  }

  const symbol = encodeRmqrVersion(text, version, eclevel);
  if (!symbol) {
    throw new Error(
      `This value does not fit in rMQR version ${version} at ${eclevel} error correction. Choose a larger version or reduce the content.`,
    );
  }

  return { version, symbol };
}

function chooseFittedRmqr(
  text: string,
  eclevel: "M" | "H",
  maxWidth: number | undefined,
  maxHeight: number | undefined,
  minimumX: number | undefined,
  rotation: Rotation,
): RmqrSelection {
  if (!Number.isFinite(maxWidth) || !Number.isFinite(maxHeight) ||
    (maxWidth ?? 0) <= 0 || (maxHeight ?? 0) <= 0) {
    throw new Error("Enter a positive maximum width and height for rMQR fit mode.");
  }

  const xFloor = minimumX ?? GUIDANCE.rmqr.compactX;
  if (!Number.isFinite(xFloor) || xFloor <= 0) {
    throw new Error("The minimum rMQR X-dimension must be greater than 0 mm.");
  }

  const candidates = rmqrCandidates(text, eclevel).map((candidate) => {
    const unrotatedColumns = candidate.symbol.pixx + QUIET_ZONE_MODULES.rmqr * 2;
    const unrotatedRows = candidate.symbol.pixy + QUIET_ZONE_MODULES.rmqr * 2;
    const physicalColumns = rotation === "R" ? unrotatedRows : unrotatedColumns;
    const physicalRows = rotation === "R" ? unrotatedColumns : unrotatedRows;
    const xDimension = Math.min(maxWidth! / physicalColumns, maxHeight! / physicalRows);
    return { ...candidate, xDimension };
  }).filter((candidate) => candidate.xDimension + Number.EPSILON >= xFloor);

  if (!candidates.length) {
    throw new Error(
      `No rMQR version that carries this value fits within ${maxWidth} × ${maxHeight} mm at the ${xFloor.toFixed(3)} mm minimum X-dimension. Increase the box, lower the X-dimension floor, reduce the content, or rotate the symbol.`,
    );
  }

  candidates.sort((left, right) =>
    right.xDimension - left.xDimension ||
    (left.symbol.pixx + 4) * (left.symbol.pixy + 4) -
      (right.symbol.pixx + 4) * (right.symbol.pixy + 4) ||
    left.symbol.pixy - right.symbol.pixy || left.symbol.pixx - right.symbol.pixx
  );
  return candidates[0];
}

function friendlyCapacityError(kind: BarcodeKind, shape?: DataMatrixShape): Error {
  if (kind === "microqr") {
    return new Error(
      "This value does not fit in Micro QR. Use QR Code, Data Matrix, Aztec, or PDF417 for a larger payload.",
    );
  }
  if (kind === "datamatrix" && shape === "rectangle") {
    return new Error(
      "This value does not fit in rectangular Data Matrix. Switch to the square shape or use QR Code, Aztec, or PDF417.",
    );
  }
  if (kind === "rmqr") {
    return new Error(
      "This value does not fit in rMQR. Use QR Code, Data Matrix, Aztec, or PDF417 for a larger payload.",
    );
  }
  if (kind === "aztec") {
    return new Error("This value is too large for Aztec Code. Use QR Code or PDF417.");
  }
  if (kind === "pdf417") {
    return new Error("This value is too large for one PDF417 symbol.");
  }
  return new Error("This value cannot be encoded in the selected barcode format.");
}

function getViewBox(svg: string): [number, number] {
  const match = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  if (!match) throw new Error("The barcode renderer returned an invalid SVG.");
  return [Number(match[1]), Number(match[2])];
}

function applyPhysicalSize(svg: string, widthMm: number, heightMm: number): string {
  return svg.replace(
    "<svg ",
    `<svg width="${widthMm.toFixed(3)}mm" height="${heightMm.toFixed(3)}mm" `,
  );
}

function removeTrailingSvgPaths(svg: string, count: number): string {
  let result = svg;
  for (let index = 0; index < count; index += 1) {
    const paths = [...result.matchAll(/<path\b[^>]*\/>/g)];
    const lastPath = paths.at(-1);
    if (!lastPath || lastPath.index === undefined) break;
    result = `${result.slice(0, lastPath.index)}${result.slice(lastPath.index + lastPath[0].length)}`;
  }
  return result;
}

function linearModuleWidth(kind: BarcodeKind, value: string): number {
  const raw = bwipjs.raw({ bcid: BCID[kind], text: value })[0];
  if (!("sbs" in raw)) return 0;
  // BWIPP renders ITF narrow elements at 1X and wide elements at 3X.
  if (kind === "itf14") {
    return raw.sbs.reduce((total, width) => total + (width * 2 - 1), 0);
  }
  return raw.sbs.reduce((total, width) => total + width, 0);
}

function renderBarcodeAtX(input: RenderInput): RenderedBarcode {
  const validation = validateValue(input.kind, input.value);
  if (validation.error) throw new Error(validation.error);

  const guidance = GUIDANCE[input.kind];
  const dataMatrixShape = input.dataMatrixShape ?? "square";
  const rmqrShape = input.rmqrShape ?? "compact";
  const rmqrMode = input.rmqrMode ?? "auto";
  const bcid = input.kind === "datamatrix" && dataMatrixShape === "rectangle"
    ? "datamatrixrectangular"
    : BCID[input.kind];
  let xDimension = input.preset === "custom"
    ? input.customX
    : input.preset === "compact"
      ? guidance.compactX
      : guidance.targetX;
  const barHeight = input.barHeightOverride ??
    (input.preset === "custom"
      ? input.customHeight
      : input.preset === "compact"
        ? guidance.compactHeight
        : guidance.targetHeight);
  const scale = 10;
  const quietModules = QUIET_ZONE_MODULES[input.kind];
  const isTwoDimensional = !BARCODE_TYPES.find((type) => type.id === input.kind)?.linear;
  const options: Parameters<typeof bwipjs.toSVG>[0] & Record<string, unknown> = {
    bcid,
    text: validation.encoded,
    scale,
    rotate: input.rotation,
    monochrome: true,
    backgroundcolor: "FFFFFF",
    barcolor: "111111",
    textcolor: "111111",
  };

  let moduleCount: number | undefined;
  let moduleColumns: number | undefined;
  let moduleRows: number | undefined;
  let symbolVersion: string | undefined;

  if (isTwoDimensional) {
    const rawOptions: Parameters<typeof bwipjs.raw>[0] & Record<string, unknown> = {
      bcid,
      text: validation.encoded,
    };

    let selectedRmqr: RmqrSelection | undefined;
    if (input.kind === "qr") {
      rawOptions.eclevel = input.errorCorrection;
      rawOptions.fixedeclevel = true;
      options.fixedeclevel = true;
    } else if (input.kind === "microqr") {
      rawOptions.eclevel = input.errorCorrection === "H" ? "Q" : input.errorCorrection;
      rawOptions.fixedeclevel = true;
      options.fixedeclevel = true;
    } else if (input.kind === "rmqr") {
      const eclevel = input.errorCorrection === "H" ? "H" : "M";
      if (rmqrMode === "fit") {
        selectedRmqr = chooseFittedRmqr(
          validation.encoded,
          eclevel,
          input.rmqrMaxWidth,
          input.rmqrMaxHeight,
          input.rmqrMinX,
          input.rotation,
        );
        xDimension = selectedRmqr.xDimension!;
      } else if (rmqrMode === "exact") {
        selectedRmqr = chooseExactRmqr(validation.encoded, input.rmqrVersion, eclevel);
      } else {
        selectedRmqr = chooseAutomaticRmqr(validation.encoded, rmqrShape, eclevel);
      }
      rawOptions.version = selectedRmqr.version;
      rawOptions.eclevel = eclevel;
      rawOptions.fixedeclevel = true;
      options.version = selectedRmqr.version;
      options.eclevel = eclevel;
      options.fixedeclevel = true;
      symbolVersion = selectedRmqr.version;
    } else if (input.kind === "aztec") {
      const aztecErrorCorrection = { L: 10, M: 23, Q: 33, H: 50 } as const;
      rawOptions.eclevel = aztecErrorCorrection[input.errorCorrection];
      options.eclevel = aztecErrorCorrection[input.errorCorrection];
    } else if (input.kind === "pdf417") {
      const pdfErrorCorrection = { L: 2, M: 3, Q: 4, H: 5 } as const;
      rawOptions.eclevel = pdfErrorCorrection[input.errorCorrection];
      rawOptions.rowmult = 3;
      options.eclevel = pdfErrorCorrection[input.errorCorrection];
      options.rowmult = 3;
    }

    let rawSymbol: MatrixRawSymbol;
    try {
      const candidate = selectedRmqr?.symbol ?? bwipjs.raw(rawOptions)[0];
      if (!isMatrixRawSymbol(candidate)) {
        throw new Error("Could not determine the 2D symbol size.");
      }
      rawSymbol = candidate;
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Could not determine")) throw error;
      throw friendlyCapacityError(input.kind, dataMatrixShape);
    }

    moduleColumns = rawSymbol.pixx;
    moduleRows = rawSymbol.pixy;
    moduleCount = moduleColumns === moduleRows ? moduleColumns : undefined;
    options.padding = quietModules * 2;
    if (input.kind === "qr" || input.kind === "microqr") {
      options.eclevel = rawOptions.eclevel;
    }
  } else {
    const eanUpcMagnification = EAN_UPC_KINDS.has(input.kind)
      ? Math.max(0.01, xDimension / guidance.targetX)
      : 1;
    options.height = barHeight === undefined ? undefined : barHeight / eanUpcMagnification;
    if (EAN_UPC_KINDS.has(input.kind)) {
      // BWIPP changes only the horizontal scale when width is reduced. Match
      // the vertical text scale to the EAN/UPC magnification so OCR-B digits
      // keep their intended proportions instead of looking condensed.
      options.scaleY = scale * eanUpcMagnification;
    }
    // EAN/UPC renderers use the outside HRI digits to establish the full
    // standards-sized canvas. Always build that layout, then remove only the
    // text paths below when HRI is disabled. Otherwise EAN-13 and UPC-A lose
    // their left-side quiet-zone geometry and render on a narrower canvas.
    options.includetext = EAN_UPC_KINDS.has(input.kind) ? true : input.includeText;
    options.textfont = "OCR-B";
    options.textsize = input.kind === "ean8" ? 9 : 10;

    if (EAN_UPC_KINDS.has(input.kind)) {
      // Asking BWIPP for guard whitespace preserves the full standards-sized clear
      // area. The optional visual indicators are removed from the SVG below.
      options.guardwhitespace = true;
    } else {
      options.textxalign = "center";
    }

    const symbolModules = linearModuleWidth(input.kind, validation.encoded);
    options.width = symbolModules * xDimension;
    if (input.kind === "itf14") {
      const bearerWidthPoints = 5 * xDimension * 2.835;
      options.borderleft = 10 * xDimension * 2.835;
      options.borderright = 10 * xDimension * 2.835;
      options.borderwidth = bearerWidthPoints;

      // BWIPP's default text position assumes its thinner default bearer bar.
      // Move the HRI down as the GS1-sized bar grows, leaving more than the
      // required 1.02 mm clear gap below the bottom bearer bar.
      options.textyoffset = -(bearerWidthPoints + 2);
    }
    if (input.kind === "code128") {
      const quietZoneMm = quietModules * xDimension;
      const paddingPoints = Math.max(1, Math.ceil(quietZoneMm * 2.835));
      options.paddingleft = paddingPoints;
      options.paddingright = paddingPoints;
    }
  }

  if (!Number.isFinite(xDimension) || xDimension <= 0) {
    throw new Error(
      isTwoDimensional
        ? "Module size must be greater than 0 mm."
        : "X-dimension must be greater than 0 mm.",
    );
  }
  if (!isTwoDimensional && (!Number.isFinite(barHeight) || (barHeight ?? 0) <= 0)) {
    throw new Error("Bar height must be greater than 0 mm.");
  }

  let svg: string;
  try {
    svg = bwipjs.toSVG(options);
  } catch (error) {
    if (isTwoDimensional) throw friendlyCapacityError(input.kind, dataMatrixShape);
    throw error;
  }
  if (EAN_UPC_KINDS.has(input.kind)) {
    if (input.includeText) {
      svg = removeTrailingSvgPaths(svg, input.kind === "ean8" ? 2 : 1);
    } else {
      const pathCount = [...svg.matchAll(/<path\b[^>]*\/>/g)].length;
      // BWIPP emits four grouped bar paths first, followed by HRI glyphs and
      // optional quiet-zone indicators. Preserve the bars and remove the rest.
      svg = removeTrailingSvgPaths(svg, Math.max(0, pathCount - 4));
    }
  }
  const [viewWidth, viewHeight] = getViewBox(svg);
  let widthMm: number;
  let heightMm: number;

  if (isTwoDimensional && moduleColumns && moduleRows) {
    const unrotatedWidth = (moduleColumns + quietModules * 2) * xDimension;
    const unrotatedHeight = (moduleRows + quietModules * 2) * xDimension;
    widthMm = input.rotation === "R" ? unrotatedHeight : unrotatedWidth;
    heightMm = input.rotation === "R" ? unrotatedWidth : unrotatedHeight;
  } else {
    widthMm = viewWidth / scale / 2.835;
    heightMm = viewHeight / scale / 2.835;
  }

  svg = applyPhysicalSize(svg, widthMm, heightMm);

  return {
    svg,
    widthMm,
    heightMm,
    moduleCount,
    moduleColumns,
    moduleRows,
    symbolVersion,
    rmqrVersion: input.kind === "rmqr" ? symbolVersion as RmqrVersion : undefined,
    xDimension,
    barHeight,
    encoded: validation.encoded,
  };
}

function renderBarcodeForSize(input: RenderInput): RenderedBarcode {
  if (input.kind === "rmqr" && input.rmqrMode === "fit") {
    return renderBarcodeAtX({ ...input, targetWidth: undefined });
  }

  const requestedWidth = input.preset === "custom" ? input.targetWidth : undefined;
  const requestedHeight = input.preset === "custom" ? input.targetHeight : undefined;
  if (requestedWidth !== undefined && (!Number.isFinite(requestedWidth) || requestedWidth <= 0)) {
    throw new Error("Total output width must be greater than 0 mm.");
  }
  if (requestedHeight !== undefined && (!Number.isFinite(requestedHeight) || requestedHeight <= 0)) {
    throw new Error("Total output height must be greater than 0 mm.");
  }
  if (requestedWidth === undefined && requestedHeight === undefined) return renderBarcodeAtX(input);

  const isLinear = BARCODE_TYPES.find((type) => type.id === input.kind)?.linear ?? false;
  if (isLinear && requestedHeight !== undefined) {
    throw new Error("Use bar height to set the height of a linear barcode.");
  }
  if (!isLinear) {
    const initial = renderBarcodeAtX({ ...input, targetWidth: undefined, targetHeight: undefined });
    const exactX = requestedHeight !== undefined
      ? initial.xDimension * requestedHeight / initial.heightMm
      : initial.xDimension * requestedWidth! / initial.widthMm;
    return renderBarcodeAtX({ ...input, customX: exactX, targetWidth: undefined, targetHeight: undefined });
  }

  if (input.rotation === "R" && requestedWidth !== undefined) {
    const initial = renderBarcodeAtX({ ...input, targetWidth: undefined, targetHeight: undefined });
    const exactBarHeight = (initial.barHeight ?? input.customHeight) + requestedWidth - initial.widthMm;
    if (!Number.isFinite(exactBarHeight) || exactBarHeight <= 0) {
      throw new Error("Total output width is too small for this rotated barcode.");
    }
    return renderBarcodeAtX({
      ...input,
      barHeightOverride: exactBarHeight,
      targetWidth: undefined,
      targetHeight: undefined,
    });
  }

  const validation = validateValue(input.kind, input.value);
  if (validation.error) throw new Error(validation.error);
  const symbolModules = linearModuleWidth(input.kind, validation.encoded);
  if (requestedWidth === undefined) return renderBarcodeAtX(input);
  // BWIPP's linear renderer accepts a bar width from 0.01 to 20 inches. Keep
  // every probe just inside that range. The previous search used the requested
  // physical width as an X-dimension upper bound, so a harmless request such as
  // a 20 mm EAN-13 first tried an invalid 10 mm X-dimension and failed before
  // the search could converge.
  let low = 0.254001 / symbolModules;
  let high = 507.999 / symbolModules;
  if (input.kind === "itf14") {
    // BWIPP also limits bearer-bar thickness to 10 points. At the required 5X
    // thickness, this is the largest safe ITF-14 X-dimension.
    high = Math.min(high, (10 / (5 * 2.835)) * 0.99999);
  }

  const firstX = Math.min(high, Math.max(low, requestedWidth / symbolModules));
  let closest = renderBarcodeAtX({
    ...input,
    customX: firstX,
    targetWidth: undefined,
  });
  if ((firstX === high && closest.widthMm + 0.08 < requestedWidth) ||
    (firstX === low && closest.widthMm - 0.08 > requestedWidth)) {
    throw new Error("This total width is outside the renderer's range for this barcode. Choose a different width.");
  }
  for (let index = 0; index < 24; index += 1) {
    const customX = (low + high) / 2;
    const candidate = renderBarcodeAtX({ ...input, customX, targetWidth: undefined });
    if (Math.abs(candidate.widthMm - requestedWidth) < Math.abs(closest.widthMm - requestedWidth)) {
      closest = candidate;
    }
    if (candidate.widthMm < requestedWidth) low = customX;
    else high = customX;
  }
  if (Math.abs(closest.widthMm - requestedWidth) > 0.08) {
    throw new Error("This total width is outside the renderer's range for this barcode. Choose a different width.");
  }
  return closest;
}

export function renderBarcode(input: RenderInput): RenderedBarcode {
  const rendered = renderBarcodeForSize(input);
  if (!Number.isFinite(rendered.widthMm) || !Number.isFinite(rendered.heightMm) ||
    rendered.widthMm > 1000 || rendered.heightMm > 1000) {
    throw new Error("Output size must not exceed 1,000 mm on either side.");
  }
  return rendered;
}

/** Scale both visible axes, accounting for HRI and bearer bars at the new X. */
export function scaleLinearBarcode(input: RenderInput, factor: number): RenderedBarcode {
  if (!Number.isFinite(factor) || factor <= 0) throw new Error("Scale must be greater than zero.");
  const current = renderBarcode(input);
  const currentWidth = input.rotation === "R" ? current.heightMm : current.widthMm;
  const currentHeight = input.rotation === "R" ? current.widthMm : current.heightMm;
  const resized = renderBarcode({
    ...input,
    preset: "custom",
    customX: current.xDimension,
    customHeight: current.barHeight ?? input.customHeight,
    rotation: "N",
    targetWidth: currentWidth * factor,
    targetHeight: undefined,
  });
  return renderBarcode({
    ...input,
    preset: "custom",
    customX: resized.xDimension,
    barHeightOverride: (resized.barHeight ?? input.customHeight) + currentHeight * factor - resized.heightMm,
    targetWidth: undefined,
    targetHeight: undefined,
  });
}

export function filenameFor(
  kind: BarcodeKind,
  encoded: string,
  extension: "svg" | "png",
  dpi?: number,
) {
  const fileType: Record<BarcodeKind, string> = {
    qr: "QR",
    ean13: "EAN13",
    upca: "UPCA",
    ean8: "EAN8",
    itf14: "ITF14",
    code128: "Code128",
    datamatrix: "DataMatrix",
    microqr: "MicroQR",
    rmqr: "rMQR",
    aztec: "Aztec",
    pdf417: "PDF417",
  };
  const safeValue = encoded
    .replace(/^https?:\/\//, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48)
    .replace(/-$/, "");
  const density = extension === "png" && dpi ? `-${dpi}dpi` : "";
  return `${fileType[kind]}-${safeValue || "barcode"}${density}.${extension}`;
}

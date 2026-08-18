"use client";

import {
  AlertTriangle,
  ArrowDownToLine,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  Info,
  Link2,
  RectangleHorizontal,
  RotateCw,
  Square,
  Unlink2,
} from "lucide-react";
import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BARCODE_TYPES,
  GUIDANCE,
  PORTABLE_2D_KINDS,
  RMQR_VERSIONS,
  analyzeBarcodeCapacity,
  filenameFor,
  isNumericKind,
  renderBarcode,
  validateValue,
  type BarcodeKind,
  type RmqrMode,
  type RmqrVersion,
  type Rotation,
  type SizePreset,
} from "./barcode";
import { addPngDensity } from "./png";
import { buildRulerScale, formatRulerDimension } from "./ruler";
import { barHeightForOutputHeight, heightWarningSeverity, linearAxisControlsBarHeight, parseGuidedDimension, roundEditableMm } from "./dimension-editor";

const DPI_OPTIONS = [300, 600, 1200] as const;
const ERROR_CORRECTION_PERCENT = { L: 7, M: 15, Q: 25, H: 30 } as const;

const GS1_GENERAL_SPECIFICATIONS = "https://ref.gs1.org/standards/genspecs/#page=410";
const GS1_2D_GUIDELINE = "https://ref.gs1.org/guidelines/2d-in-retail/#h-adjusting-x-dimension-and-quiet-zone";
const GS1_PRESET_KINDS = new Set<BarcodeKind>(["ean13", "upca", "ean8", "itf14"]);
const GS1_HRI_KINDS = new Set<BarcodeKind>(["ean13", "upca", "ean8", "itf14"]);
const STORAGE_KEY = "codeform.drafts.v1";
const MAX_SAVED_VALUE_LENGTH = 8192;
const DENSO_QR_TERMS = "https://www.qrcode.com/en/faq.html#patentH2Title";
const DENSO_MICRO_QR = "https://www.qrcode.com/en/codes/microqr.html#standardH2Title";
const DENSO_MICRO_QR_CAPACITY = "https://www.qrcode.com/en/codes/microqr.html#capacityH2Title";
const DENSO_RMQR = "https://www.qrcode.com/en/codes/rmqr.html#r02";
const DENSO_IQR = "https://www.qrcode.com/en/codes/iqr.html#capacityRectangle";

const PORTABLE_2D_SET = new Set<BarcodeKind>(PORTABLE_2D_KINDS);

const FORMAT_NOTES: Record<
  BarcodeKind,
  { lead: string; detail: string; url?: string; source?: string }
> = {
  qr: {
    lead: "Best general-purpose choice",
    detail: "Excellent phone and scanner support for links and text. Use this unless a special shape or workflow calls for something else.",
    url: "https://www.qrcode.com/en/about/#featureArea",
    source: "QR basics",
  },
  rmqr: {
    lead: "Best for a low, wide space",
    detail: "rMQR is the standardized rectangular QR variant. It is ideal for a narrow box edge, but support is not as universal as normal QR.",
    url: DENSO_RMQR,
    source: "rMQR specification",
  },
  microqr: {
    lead: "Smallest square for very short data",
    detail: "Micro QR can use less total area than rMQR for short values. Scanner support is more limited than normal QR, so test the intended device.",
    url: DENSO_MICRO_QR,
    source: "Micro QR specification",
  },
  datamatrix: {
    lead: "Strong compact-label option",
    detail: "Data Matrix is widely used on parts and small labels. Choose Rectangle when a low, wide footprint fits the artwork better.",
    url: "https://www.iso.org/standard/80926.html",
    source: "ISO standard",
  },
  aztec: {
    lead: "Useful for tickets and travel",
    detail: "Aztec stores text or offline data in a compact square and is common in transport workflows. QR is usually better for a public web link.",
    url: "https://www.iso.org/standard/82441.html",
    source: "ISO standard",
  },
  pdf417: {
    lead: "Useful for IDs and larger offline records",
    detail: "PDF417 is a stacked, wide symbol used on tickets and identity documents. It is not the first choice for a phone link.",
    url: "https://www.iso.org/standard/65500.html",
    source: "ISO standard",
  },
  ean13: {
    lead: "Retail GTIN-13",
    detail: "Use only for an assigned GTIN-13. Enter 12 digits and Barcode Generator calculates the check digit, or enter all 13 for validation.",
  },
  upca: {
    lead: "North American retail GTIN-12",
    detail: "Use only for an assigned UPC-A number. The smaller first and last digits are the standard number-system and check digits.",
  },
  ean8: {
    lead: "Compact assigned retail number",
    detail: "EAN-8 is not a shortened EAN-13. Use it only when an authorized GS1 organization has assigned a GTIN-8.",
  },
  itf14: {
    lead: "Outer-case logistics code",
    detail: "ITF-14 is for GTIN-14 on cases and shipping units, not retail checkout. Bearer bars and quiet zones are included.",
  },
  code128: {
    lead: "Flexible internal linear code",
    detail: "A good choice for part numbers and internal labels. Longer content makes the symbol wider, so keep values concise.",
  },
};

const SIZE_SOURCES: Record<BarcodeKind, { summary: string; url?: string }> = {
  qr: {
    summary: "GS1 retail POS sets 0.396 mm minimum and 0.495 mm target for QR Codes carrying uncompressed GS1 Digital Link. These are not universal requirements for arbitrary QR content.",
    url: GS1_2D_GUIDELINE,
  },
  ean13: {
    summary: "Retail target X is 0.330 mm. Minimum quiet zones are 11X left and 7X right.",
    url: GS1_GENERAL_SPECIFICATIONS,
  },
  upca: {
    summary: "Retail target X is 0.330 mm, with 9X quiet zones on both sides.",
    url: GS1_GENERAL_SPECIFICATIONS,
  },
  ean8: {
    summary: "Retail target X is 0.330 mm, with 7X quiet zones on both sides.",
    url: GS1_GENERAL_SPECIFICATIONS,
  },
  itf14: {
    summary: "General distribution uses 31.75 mm bars and 10X quiet zones. Direct corrugate should use X of at least 0.635 mm.",
    url: GS1_GENERAL_SPECIFICATIONS,
  },
  code128: {
    summary: "Code 128 has no single universal physical minimum. These are conservative label defaults with a 10X clear area; test the real print with its intended scanner.",
  },
  datamatrix: {
    summary: "GS1 retail POS sets 0.396 mm minimum and 0.495 mm target for GS1 DataMatrix and Data Matrix carrying GS1 Digital Link. These are not universal requirements for arbitrary Data Matrix content.",
    url: GS1_2D_GUIDELINE,
  },
  microqr: {
    summary: "Micro QR has no universal physical minimum and has more limited scanner support. Use these as conservative reference sizes and test the finished label.",
    url: DENSO_MICRO_QR,
  },
  rmqr: {
    summary: "rMQR has a 2-module quiet zone and a low rectangular footprint. These general-use sizes are not a universal standard; scanner support varies, so test the intended device.",
    url: DENSO_RMQR,
  },
  aztec: {
    summary: "Aztec has no single universal print minimum. These default sizes preserve a clear edge and should be verified on the final material.",
    url: "https://www.iso.org/standard/82441.html",
  },
  pdf417: {
    summary: "PDF417 sizing depends on the reader and application. These general-use sizes are not a universal standard; preserve the clear edge and test the final print.",
    url: "https://www.iso.org/standard/65500.html",
  },
};

function defaultValues() {
  return Object.fromEntries(BARCODE_TYPES.map((type) => [type.id, type.example])) as Record<
    BarcodeKind,
    string
  >;
}

function isBarcodeKind(value: unknown): value is BarcodeKind {
  return typeof value === "string" && BARCODE_TYPES.some((type) => type.id === value);
}

function friendlyRenderError(kind: BarcodeKind, error: unknown) {
  const raw = error instanceof Error ? error.message : String(error);
  if (kind === "microqr") {
    return "This content does not fit Micro QR. It has been kept unchanged, so you can switch to QR, rMQR, or Data Matrix.";
  }
  if (kind === "rmqr") {
    return raw.replace(/^bwipp\.[^:]+:\s*/i, "") || "This content does not fit the selected rMQR settings.";
  }
  if (/too (?:much|long)|cannot encode|capacity|maximum|no barcode/i.test(raw)) {
    return `This content does not fit ${BARCODE_TYPES.find((type) => type.id === kind)?.label ?? "this format"}. It has been kept unchanged.`;
  }
  return raw.replace(/^bwipp\.[^:]+:\s*/i, "") || "This symbol cannot encode the current value.";
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function formatMm(value: number) {
  return value < 10 ? value.toFixed(2) : value.toFixed(1);
}

function formatDimensions(barcode: { widthMm: number; heightMm: number } | null) {
  return barcode ? `${formatMm(barcode.widthMm)} × ${formatMm(barcode.heightMm)} mm` : "Unavailable";
}

function formatLabeledDimensions(barcode: { widthMm: number; heightMm: number } | null) {
  return barcode ? `W ${formatMm(barcode.widthMm)} × H ${formatMm(barcode.heightMm)} mm` : "Unavailable";
}

function formatRmqrVersion(version: string) {
  return version.replace("x", "×");
}

function formatCount(count: number, unit: "digits" | "characters" | "bytes") {
  const singular = unit === "digits" ? "digit" : unit === "characters" ? "character" : "byte";
  return `${count} ${count === 1 ? singular : unit}`;
}

function barcodeKindFromUrl() {
  const raw = new URL(window.location.href).searchParams.get("type");
  const candidate = raw?.toLowerCase();
  return {
    kind: isBarcodeKind(candidate) ? candidate : null,
    hasType: raw !== null,
  };
}

function writeBarcodeKindToUrl(kind: BarcodeKind, mode: "push" | "replace") {
  const url = new URL(window.location.href);
  url.searchParams.set("type", kind);
  window.history[mode === "push" ? "pushState" : "replaceState"]({ type: kind }, "", url);
}

type TooltipState = { text: string; left: number; top: number; below: boolean } | null;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

type InstallCapability = "hidden" | "prompt" | "ios" | "manual";

function isIosDevice() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isRunningAsInstalledApp() {
  return window.matchMedia("(display-mode: standalone)").matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function tooltipTextFor(element: HTMLElement): string {
  return element.dataset.tooltip ?? "";
}

export default function BarcodeStudio() {
  const appShellRef = useRef<HTMLElement>(null);
  const [kind, setKind] = useState<BarcodeKind>("ean13");
  const [values, setValues] = useState<Record<BarcodeKind, string>>(defaultValues);
  const [shared2dTouched, setShared2dTouched] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const [preset, setPreset] = useState<SizePreset>("target");
  const [customX, setCustomX] = useState(0.33);
  const [customHeight, setCustomHeight] = useState(22.85);
  const [customMeasure, setCustomMeasure] = useState<"width" | "height" | "x">("width");
  const [customWidth, setCustomWidth] = useState(37.3);
  const [customTotalHeight, setCustomTotalHeight] = useState(26.3);
  const [limitHeight, setLimitHeight] = useState(false);
  const [heightLimit, setHeightLimit] = useState(22.85);
  const [rotation, setRotation] = useState<Rotation>("N");
  const [includeText, setIncludeText] = useState(true);
  const [qrErrorCorrection, setQrErrorCorrection] = useState<"L" | "M" | "Q" | "H">("M");
  const [microQrErrorCorrection, setMicroQrErrorCorrection] = useState<"L" | "M" | "Q">("M");
  const [rmqrErrorCorrection, setRmqrErrorCorrection] = useState<"M" | "H">("M");
  const [rmqrShape, setRmqrShape] = useState<"compact" | "low-profile">("low-profile");
  const [rmqrMode, setRmqrMode] = useState<RmqrMode>("auto");
  const [rmqrVersion, setRmqrVersion] = useState<RmqrVersion>("R7x43");
  const [rmqrMaxWidth, setRmqrMaxWidth] = useState(60);
  const [rmqrMaxHeight, setRmqrMaxHeight] = useState(12);
  const [rmqrMinX, setRmqrMinX] = useState(0.3);
  const [dataMatrixShape, setDataMatrixShape] = useState<"square" | "rectangle">("square");
  const [dpi, setDpi] = useState<(typeof DPI_OPTIONS)[number]>(600);
  const [encodedCopied, setEncodedCopied] = useState(false);
  const [pngCopyStatus, setPngCopyStatus] = useState<"idle" | "copied" | "unsupported" | "error">("idle");
  const [svgCopyStatus, setSvgCopyStatus] = useState<"idle" | "vector" | "source" | "error">("idle");
  const [guideOpen, setGuideOpen] = useState(true);
  const [formatGuideOpen, setFormatGuideOpen] = useState(true);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const loadedVersionRef = useRef<string | null>(null);
  const [installCapability, setInstallCapability] = useState<InstallCapability>("manual");
  const [installMessage, setInstallMessage] = useState<string | null>(null);
  const installPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [dimensionEdit, setDimensionEdit] = useState<"width" | "height" | null>(null);
  const [dimensionDraft, setDimensionDraft] = useState("");
  const [dimensionEditError, setDimensionEditError] = useState<string | null>(null);
  const [dimensionsLinked, setDimensionsLinked] = useState(true);
  const [tooltip, setTooltip] = useState<TooltipState>(null);
  const tooltipTimerRef = useRef<number | null>(null);
  const lastStandardPreset = useRef<"target" | "compact">("target");
  const dimensionInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!dimensionEdit) return;
    dimensionInputRef.current?.focus();
    dimensionInputRef.current?.select();
  }, [dimensionEdit]);

  useEffect(() => {
    const root = appShellRef.current;
    if (!root) return;
    const selector = "[data-tooltip]";
    const cancelTooltip = () => {
      if (tooltipTimerRef.current !== null) window.clearTimeout(tooltipTimerRef.current);
      tooltipTimerRef.current = null;
      setTooltip(null);
    };
    const showTooltip = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return;
      const interactive = target.closest<HTMLElement>(selector);
      if (!interactive || !root.contains(interactive)) return;
      const text = tooltipTextFor(interactive);
      if (!text) return;
      if (tooltipTimerRef.current !== null) window.clearTimeout(tooltipTimerRef.current);
      tooltipTimerRef.current = window.setTimeout(() => {
        const rect = interactive.getBoundingClientRect();
        const below = rect.top < 72;
        setTooltip({
          text,
          left: Math.min(window.innerWidth - 14, Math.max(14, rect.left + rect.width / 2)),
          top: below ? rect.bottom + 9 : rect.top - 9,
          below,
        });
      }, 450);
    };
    const onPointerOver = (event: PointerEvent) => showTooltip(event.target);
    const onPointerOut = (event: PointerEvent) => {
      const from = event.target instanceof Element ? event.target.closest(selector) : null;
      const to = event.relatedTarget instanceof Element ? event.relatedTarget.closest(selector) : null;
      if (from !== to) cancelTooltip();
    };
    const onFocusIn = (event: FocusEvent) => showTooltip(event.target);
    const onFocusOut = () => cancelTooltip();
    root.addEventListener("pointerover", onPointerOver);
    root.addEventListener("pointerout", onPointerOut);
    root.addEventListener("focusin", onFocusIn);
    root.addEventListener("focusout", onFocusOut);
    return () => {
      cancelTooltip();
      root.removeEventListener("pointerover", onPointerOver);
      root.removeEventListener("pointerout", onPointerOut);
      root.removeEventListener("focusin", onFocusIn);
      root.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js?v=2").catch(() => {
        // Installation remains available online if offline support cannot initialize.
      });
    }

    const phoneViewport = window.matchMedia("(max-width: 880px) and (pointer: coarse)");
    const updateInstallCapability = () => {
      if (isRunningAsInstalledApp() || !phoneViewport.matches) {
        setInstallCapability("hidden");
      } else if (installPromptRef.current) {
        setInstallCapability("prompt");
      } else {
        setInstallCapability(isIosDevice() ? "ios" : "manual");
      }
    };
    const handleInstallPrompt = (event: Event) => {
      if (!phoneViewport.matches) return;
      event.preventDefault();
      installPromptRef.current = event as BeforeInstallPromptEvent;
      setInstallCapability("prompt");
      setInstallMessage(null);
    };
    const handleInstalled = () => {
      installPromptRef.current = null;
      setInstallCapability("hidden");
      setInstallMessage(null);
    };

    updateInstallCapability();
    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    phoneViewport.addEventListener("change", updateInstallCapability);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
      phoneViewport.removeEventListener("change", updateInstallCapability);
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    const checkForUpdate = async () => {
      try {
        const response = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
        if (!response.ok) return;
        const payload = await response.json() as { version?: unknown };
        if (typeof payload.version !== "string") return;
        if (loadedVersionRef.current === null) {
          loadedVersionRef.current = payload.version;
        } else if (!disposed && payload.version !== loadedVersionRef.current) {
          setUpdateAvailable(true);
        }
      } catch {
        // A temporary network failure should not interrupt barcode work.
      }
    };
    const checkWhenVisible = () => {
      if (document.visibilityState === "visible") void checkForUpdate();
    };
    void checkForUpdate();
    const interval = window.setInterval(checkForUpdate, 30_000);
    document.addEventListener("visibilitychange", checkWhenVisible);
    return () => {
      disposed = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", checkWhenVisible);
    };
  }, []);

  const applyKindSettings = useCallback((nextKind: BarcodeKind) => {
    setKind(nextKind);
    setPreset("target");
    setRotation("N");
    setCustomX(GUIDANCE[nextKind].targetX);
    setCustomHeight(GUIDANCE[nextKind].targetHeight ?? 15);
    setCustomWidth(30);
    setCustomTotalHeight(GUIDANCE[nextKind].targetHeight ?? 15);
    setCustomMeasure("width");
    setLimitHeight(false);
    setHeightLimit(GUIDANCE[nextKind].targetHeight ?? 15);
    setDimensionEdit(null);
    setDimensionEditError(null);
    lastStandardPreset.current = "target";
  }, []);

  useEffect(() => {
    const restoreTimer = window.setTimeout(() => {
      try {
        const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null") as {
          version?: number;
          activeKind?: unknown;
          values?: Record<string, unknown>;
          shared2dTouched?: unknown;
        } | null;
        let restoredKind: BarcodeKind = "ean13";
        if (saved?.version === 1) {
          const restored = defaultValues();
          for (const barcodeType of BARCODE_TYPES) {
            const candidate = saved.values?.[barcodeType.id];
            if (typeof candidate === "string" && candidate.length <= MAX_SAVED_VALUE_LENGTH) {
              restored[barcodeType.id] = candidate;
            }
          }
          setValues(restored);
          setShared2dTouched(saved.shared2dTouched === true);
          if (isBarcodeKind(saved.activeKind)) restoredKind = saved.activeKind;
        }
        const urlSelection = barcodeKindFromUrl();
        const nextKind = urlSelection.kind ?? (urlSelection.hasType ? "ean13" : restoredKind);
        applyKindSettings(nextKind);
        writeBarcodeKindToUrl(nextKind, "replace");
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
        writeBarcodeKindToUrl("ean13", "replace");
      }
      setStorageReady(true);
    }, 0);
    return () => window.clearTimeout(restoreTimer);
  }, [applyKindSettings]);

  useEffect(() => {
    const handleHistoryNavigation = () => {
      const selection = barcodeKindFromUrl();
      const nextKind = selection.kind ?? "ean13";
      applyKindSettings(nextKind);
      writeBarcodeKindToUrl(nextKind, "replace");
    };
    window.addEventListener("popstate", handleHistoryNavigation);
    return () => window.removeEventListener("popstate", handleHistoryNavigation);
  }, [applyKindSettings]);

  useEffect(() => {
    if (!storageReady) return;
    const savedValues = Object.fromEntries(
      Object.entries(values).filter(([, savedValue]) => savedValue.length <= MAX_SAVED_VALUE_LENGTH),
    );
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 1, activeKind: kind, values: savedValues, shared2dTouched }),
    );
  }, [kind, shared2dTouched, storageReady, values]);

  const type = BARCODE_TYPES.find((item) => item.id === kind)!;
  const guidance = GUIDANCE[kind];
  const value = values[kind];
  const validation = useMemo(() => validateValue(kind, value), [kind, value]);
  const hasGs1Preset = GS1_PRESET_KINDS.has(kind);
  const hasGs1Retail2dReference = kind === "qr" || kind === "datamatrix";
  const errorCorrection = kind === "rmqr"
    ? rmqrErrorCorrection
    : kind === "microqr"
      ? microQrErrorCorrection
      : qrErrorCorrection;
  const capacity = useMemo(
    () => analyzeBarcodeCapacity({ kind, value, errorCorrection }),
    [errorCorrection, kind, value],
  );
  const dimensionName = type.linear
    ? "X-dimension"
    : kind === "pdf417"
      ? "Narrow bar (X)"
      : "Module size (X)";
  const shortDimensionName = type.linear || kind === "pdf417" ? "X-dim." : "Module";
  const usesAutomaticPrintSize = kind !== "rmqr" || rmqrMode === "auto";
  const renderPreset = usesAutomaticPrintSize ? preset : "custom";
  const hasSquareOutput = kind === "qr" || kind === "microqr" || kind === "aztec" ||
    (kind === "datamatrix" && dataMatrixShape === "square");
  const effectiveCustomMeasure = hasSquareOutput && customMeasure === "height" ? "width" : customMeasure;

  const renderResult = useMemo(() => {
    if (validation.error) return { barcode: null, error: validation.error };
    try {
      return {
        barcode: renderBarcode({
          kind,
          value,
          preset: renderPreset,
          customX,
          customHeight,
          targetWidth: usesAutomaticPrintSize && preset === "custom" && effectiveCustomMeasure === "width" ? customWidth : undefined,
          targetHeight: usesAutomaticPrintSize && !type.linear && preset === "custom" && effectiveCustomMeasure === "height" ? customTotalHeight : undefined,
          barHeightOverride: type.linear && limitHeight ? heightLimit : undefined,
          rotation,
          includeText,
          errorCorrection,
          rmqrShape,
          rmqrMode,
          rmqrVersion,
          rmqrMaxWidth,
          rmqrMaxHeight,
          rmqrMinX,
          dataMatrixShape,
        }),
        error: null,
      };
    } catch (error) {
      return { barcode: null, error: friendlyRenderError(kind, error) };
    }
  }, [
    customHeight,
    effectiveCustomMeasure,
    customTotalHeight,
    customWidth,
    customX,
    errorCorrection,
    heightLimit,
    includeText,
    kind,
    limitHeight,
    preset,
    renderPreset,
    rmqrMaxHeight,
    rmqrMaxWidth,
    rmqrMinX,
    rmqrMode,
    rmqrShape,
    rmqrVersion,
    dataMatrixShape,
    rotation,
    validation.error,
    value,
    type.linear,
    usesAutomaticPrintSize,
  ]);
  const rendered = renderResult.barcode;
  const dataError = validation.error ?? null;
  const settingsError = dataError ? null : renderResult.error;
  const hasCapacityError = Boolean(!dataError && capacity && !capacity.fits);
  const inputHasError = Boolean(dataError || hasCapacityError);
  const capacityStatus = capacity
    ? capacity.fits
      ? `${capacity.used} of ${capacity.maximum} ${capacity.unit} · ${formatCount(capacity.remaining, capacity.unit)} left`
      : `${capacity.used} of ${capacity.maximum} ${capacity.unit} · ${formatCount(capacity.overBy, capacity.unit)} over`
    : null;
  const capacityErrorMessage = capacity && !capacity.fits
    ? `${capacityStatus}. Shorten it by at least ${formatCount(capacity.overBy, capacity.unit)}, or switch to QR, rMQR, or Data Matrix.`
    : null;
  const previewError = dataError ?? capacityErrorMessage ?? settingsError;
  const isPrintSizeError = Boolean(
    !hasCapacityError && settingsError && /width|height|size|dimension|module|box|fit/i.test(settingsError),
  );
  const settingsErrorTitle = hasCapacityError
    ? "Micro QR capacity exceeded"
    : isPrintSizeError
      ? "Check the print size"
      : "Check the format settings";
  const showCompleteCode = Boolean(
    rendered && (validation.generatedCheckDigit || rendered.encoded !== value),
  );
  const previewMetadata = [
    rotation === "R" ? "90°" : null,
  ].filter(Boolean).join(" · ");
  const hasErrorCorrectionMetric = kind === "qr" || kind === "microqr" || kind === "rmqr";

  const presetMeasurements = useMemo(() => {
    if (validation.error) return { target: null, compact: null };
    const base = {
      kind,
      value,
      customX: guidance.targetX,
      customHeight: guidance.targetHeight ?? 15,
      rotation,
      includeText,
      errorCorrection,
      rmqrShape,
      dataMatrixShape,
    };
    try {
      return {
        target: renderBarcode({ ...base, preset: "target" }),
        compact: renderBarcode({ ...base, preset: "compact" }),
      };
    } catch {
      return { target: null, compact: null };
    }
  }, [dataMatrixShape, errorCorrection, guidance, includeText, kind, rmqrShape, rotation, validation.error, value]);

  const physicalWarning = useMemo(() => {
    if (!rendered) return null;
    if (kind === "itf14" && rendered.barHeight && rendered.barHeight < 31.75) {
      return {
        severity: heightWarningSeverity(rendered.barHeight, 31.75) ?? "caution",
        message: "Below the 31.75 mm distribution bar-height target. Use only when the package physically cannot accommodate it.",
      };
    }
    if (
      type.linear &&
      guidance.compactHeight &&
      rendered.barHeight &&
      rendered.barHeight < guidance.compactHeight
    ) {
      return {
        severity: heightWarningSeverity(rendered.barHeight, guidance.compactHeight) ?? "caution",
        message: `Bar height is below the ${guidance.compactHeight} mm GS1 minimum for this format. Short bars scan from fewer angles, so test the finished pack.`,
      };
    }
    if (
      (preset === "custom" || (kind === "rmqr" && rmqrMode !== "auto")) &&
      (rendered.xDimension < guidance.compactX ||
        (guidance.compactHeight && (rendered.barHeight ?? 0) < guidance.compactHeight))
    ) {
      const compactSize = presetMeasurements.compact ? formatDimensions(presetMeasurements.compact) : null;
      return {
        severity: "critical" as const,
        message: hasGs1Preset
          ? `This custom size is below the GS1 Small pack reference${compactSize ? ` (${compactSize})` : ""}. Test the finished print before use.`
          : hasGs1Retail2dReference
            ? `This custom size is below the GS1 retail POS minimum size reference${compactSize ? ` (${compactSize})` : ""}. Test the finished print with its intended scanner.`
            : `This custom size is below the Tight space reference${compactSize ? ` (${compactSize})` : ""}. Test the finished print with its intended scanner.`,
      };
    }
    if (GS1_HRI_KINDS.has(kind) && !includeText) {
      return {
        severity: "caution" as const,
        message: "GS1 normally expects human-readable digits as a backup. Hide them only for an exceptional space constraint or when equivalent readable data appears beside the symbol.",
      };
    }
    if (kind === "microqr" || kind === "rmqr") {
      return {
        severity: "caution" as const,
        message: `${type.label} support is less universal than normal QR. Test it with the scanner or phone that will actually be used.`,
      };
    }
    return null;
  }, [guidance, hasGs1Preset, hasGs1Retail2dReference, includeText, kind, preset, presetMeasurements.compact, rendered, rmqrMode, type.label, type.linear]);

  const pngWidth = rendered ? Math.ceil((rendered.widthMm / 25.4) * dpi) : 0;
  const pngHeight = rendered ? Math.ceil((rendered.heightMm / 25.4) * dpi) : 0;
  const previewAspect = rendered ? rendered.widthMm / rendered.heightMm : 1;
  const previewLargestDimension = rendered ? Math.max(rendered.widthMm, rendered.heightMm) : 0;
  const horizontalRuler = rendered
    ? buildRulerScale(rendered.widthMm, previewLargestDimension)
    : null;
  const verticalRuler = rendered
    ? buildRulerScale(rendered.heightMm, previewLargestDimension)
    : null;
  const previewSymbolStyle = rendered
    ? ({
        "--symbol-aspect": previewAspect,
        "--symbol-max-width": `${Math.max(1, previewAspect * 220)}px`,
      } as CSSProperties)
    : undefined;

  const setValue = (next: string) => {
    const normalized = isNumericKind(kind) ? next.replace(/\D/g, "") : next;
    setValues((current) => {
      if (!PORTABLE_2D_SET.has(kind)) return { ...current, [kind]: normalized };
      const updated = { ...current };
      for (const portableKind of PORTABLE_2D_KINDS) updated[portableKind] = normalized;
      return updated;
    });
    if (PORTABLE_2D_SET.has(kind)) setShared2dTouched(true);
  };

  const resetExamples = () => {
    setValues(defaultValues());
    setShared2dTouched(false);
    window.localStorage.removeItem(STORAGE_KEY);
  };

  const selectKind = (nextKind: BarcodeKind) => {
    if (nextKind === kind) return;
    applyKindSettings(nextKind);
    writeBarcodeKindToUrl(nextKind, "push");
  };

  const selectPreset = (nextPreset: SizePreset) => {
    if (nextPreset === "custom" && rendered) {
      setCustomX(rendered.xDimension);
      setCustomHeight(rendered.barHeight ?? guidance.targetHeight ?? 15);
      setCustomWidth(Number(rendered.widthMm.toFixed(2)));
      setCustomTotalHeight(Number(rendered.heightMm.toFixed(2)));
    }
    if (nextPreset === "target" || nextPreset === "compact") lastStandardPreset.current = nextPreset;
    setPreset(nextPreset);
  };

  const beginDimensionEdit = (axis: "width" | "height") => {
    if (!rendered) return;
    setDimensionDraft((axis === "width" ? rendered.widthMm : rendered.heightMm).toFixed(2));
    setDimensionEditError(null);
    setDimensionEdit(axis);
  };

  const restoreDimensionPreset = (axis: "width" | "height") => {
    if (kind === "rmqr" && rmqrMode !== "auto") {
      selectRmqrMode("auto");
      selectPreset(lastStandardPreset.current);
    } else if (type.linear && linearAxisControlsBarHeight(rotation, axis)) {
      setLimitHeight(false);
    } else {
      selectPreset(lastStandardPreset.current);
    }
    setDimensionEdit(null);
    setDimensionEditError(null);
  };

  const commitDimensionEdit = (axis: "width" | "height") => {
    if (!rendered) return;
    const compact = presetMeasurements.compact;
    const minimum = compact ? (axis === "width" ? compact.widthMm : compact.heightMm) : 0.1;
    const parsed = parseGuidedDimension(dimensionDraft, minimum, axis);
    if (parsed.action === "restore") {
      restoreDimensionPreset(axis);
      return;
    }
    if (parsed.action === "error") {
      setDimensionEditError(parsed.message);
      return;
    }

    if (dimensionsLinked && !hasSquareOutput) {
      const currentDimension = axis === "width" ? rendered.widthMm : rendered.heightMm;
      const scale = parsed.value / currentDimension;
      if (kind === "rmqr") {
        setRmqrMode("exact");
        if (rendered.rmqrVersion) setRmqrVersion(rendered.rmqrVersion);
      } else {
        selectPreset("custom");
      }
      setCustomMeasure("x");
      setCustomX(rendered.xDimension * scale);
      if (type.linear) {
        const otherCurrentDimension = axis === "width" ? rendered.heightMm : rendered.widthMm;
        const targetOutputHeight = axis === "width" ? otherCurrentDimension * scale : parsed.value;
        setHeightLimit(roundEditableMm(barHeightForOutputHeight(
          rendered.heightMm,
          rendered.barHeight ?? guidance.targetHeight ?? 15,
          targetOutputHeight,
        )));
        setLimitHeight(true);
      }
      setDimensionEdit(null);
      setDimensionEditError(null);
      return;
    }

    if (kind === "rmqr" && rmqrMode === "fit") {
      if (axis === "width") setRmqrMaxWidth(parsed.value);
      else setRmqrMaxHeight(parsed.value);
    } else if (kind === "rmqr" && rmqrMode === "exact") {
      const currentDimension = axis === "width" ? rendered.widthMm : rendered.heightMm;
      setCustomX(rendered.xDimension * parsed.value / currentDimension);
    } else if (type.linear && linearAxisControlsBarHeight(rotation, axis)) {
      selectPreset("custom");
      const currentOutputDimension = axis === "width" ? rendered.widthMm : rendered.heightMm;
      setHeightLimit(roundEditableMm(barHeightForOutputHeight(
        currentOutputDimension,
        rendered.barHeight ?? guidance.targetHeight ?? 15,
        parsed.value,
      )));
      setLimitHeight(true);
    } else if (type.linear) {
      selectPreset("custom");
      setCustomMeasure("x");
      const currentOutputDimension = axis === "width" ? rendered.widthMm : rendered.heightMm;
      setCustomX(rendered.xDimension * parsed.value / currentOutputDimension);
    } else if (hasSquareOutput) {
      selectPreset("custom");
      setCustomMeasure("width");
      setCustomWidth(parsed.value);
    } else if (axis === "width") {
      selectPreset("custom");
      setCustomMeasure("width");
      setCustomWidth(parsed.value);
    } else {
      selectPreset("custom");
      setCustomMeasure("height");
      setCustomTotalHeight(parsed.value);
    }
    setDimensionEdit(null);
    setDimensionEditError(null);
  };

  const selectRmqrMode = (nextMode: RmqrMode) => {
    if (nextMode === "fit" && rendered) {
      setRmqrMaxWidth(Number(rendered.widthMm.toFixed(2)));
      setRmqrMaxHeight(Number(rendered.heightMm.toFixed(2)));
    }
    if (nextMode === "exact" && rendered?.rmqrVersion) {
      setRmqrVersion(rendered.rmqrVersion);
      setCustomX(Number(rendered.xDimension.toFixed(3)));
    }
    setRmqrMode(nextMode);
  };

  const downloadSvg = () => {
    if (!rendered) return;
    downloadBlob(
      new Blob([rendered.svg], { type: "image/svg+xml;charset=utf-8" }),
      filenameFor(kind, rendered.encoded, "svg"),
    );
  };

  const createPngBlob = async (): Promise<Blob> => {
    if (!rendered) throw new Error("There is no barcode to export.");
    const svgBlob = new Blob([rendered.svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    const image = new Image();
    image.decoding = "sync";
    try {
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("Could not prepare the PNG."));
        image.src = url;
      });
    } finally {
      URL.revokeObjectURL(url);
    }

    const canvas = document.createElement("canvas");
    canvas.width = pngWidth;
    canvas.height = pngHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not prepare the PNG.");
    context.imageSmoothingEnabled = false;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((pngBlob) => {
        if (pngBlob) resolve(pngBlob);
        else reject(new Error("Could not prepare the PNG."));
      }, "image/png");
    });
    const pngBytes = new Uint8Array(await blob.arrayBuffer());
    const printReadyBytes = addPngDensity(pngBytes, dpi);
    return new Blob([printReadyBytes], { type: "image/png" });
  };

  const downloadPng = async () => {
    if (!rendered) return;
    const pngBlob = await createPngBlob();
    downloadBlob(pngBlob, filenameFor(kind, rendered.encoded, "png", dpi));
  };

  const copyPng = async () => {
    if (!rendered) return;
    const canCopyPng = Boolean(
      navigator.clipboard?.write &&
      typeof ClipboardItem !== "undefined" &&
      (typeof ClipboardItem.supports !== "function" || ClipboardItem.supports("image/png")),
    );
    if (!canCopyPng) {
      setPngCopyStatus("unsupported");
      window.setTimeout(() => setPngCopyStatus("idle"), 2600);
      return;
    }
    try {
      const pngBlob = createPngBlob();
      await navigator.clipboard.write([new ClipboardItem({ "image/png": pngBlob })]);
      setPngCopyStatus("copied");
    } catch {
      setPngCopyStatus("error");
    }
    window.setTimeout(() => setPngCopyStatus("idle"), 2600);
  };

  const copyEncoded = async () => {
    if (!rendered) return;
    await navigator.clipboard.writeText(rendered.encoded);
    setEncodedCopied(true);
    window.setTimeout(() => setEncodedCopied(false), 1400);
  };

  const copySvg = async () => {
    if (!rendered) return;
    const svgBlob = new Blob([rendered.svg], { type: "image/svg+xml" });
    const clipboardWidthPx = rendered.widthMm * 96 / 25.4;
    const clipboardHeightPx = rendered.heightMm * 96 / 25.4;
    const clipboardHtmlSvg = rendered.svg.replace(
      /<svg width="[^"]+" height="[^"]+" /,
      `<svg width="${clipboardWidthPx.toFixed(3)}" height="${clipboardHeightPx.toFixed(3)}" `,
    );
    const canWriteRichClipboard = Boolean(
      navigator.clipboard?.write &&
      typeof ClipboardItem !== "undefined",
    );
    if (canWriteRichClipboard) {
      try {
        const clipboardTypes: Record<string, Blob> = {
          "text/html": new Blob([`<!doctype html><html><body>${clipboardHtmlSvg}</body></html>`], { type: "text/html" }),
          "text/plain": new Blob([rendered.svg], { type: "text/plain" }),
        };
        if (typeof ClipboardItem.supports === "function" && ClipboardItem.supports("image/svg+xml")) {
          clipboardTypes["image/svg+xml"] = svgBlob;
        }
        await navigator.clipboard.write([new ClipboardItem(clipboardTypes)]);
        setSvgCopyStatus("vector");
        window.setTimeout(() => setSvgCopyStatus("idle"), 2200);
        return;
      } catch {
        // Fall back to exact SVG markup below.
      }
    }
    try {
      await navigator.clipboard.writeText(rendered.svg);
      setSvgCopyStatus("source");
    } catch {
      setSvgCopyStatus("error");
    }
    window.setTimeout(() => setSvgCopyStatus("idle"), 2200);
  };

  const installPwa = async () => {
    const installPrompt = installPromptRef.current;
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      installPromptRef.current = null;
      if (choice.outcome === "accepted") {
        setInstallMessage("Installation started. Barcode Generator will appear with your apps.");
      } else {
        setInstallCapability("manual");
        setInstallMessage("Install cancelled. You can try again from your browser menu.");
      }
      return;
    }

    if (installCapability === "ios") {
      setInstallMessage("Tap Share, choose Add to Home Screen, then keep Open as Web App enabled.");
    } else {
      setInstallMessage("Open your browser menu and choose Install app or Add to Home screen.");
    }
  };

  return (
    <main className="app-shell" ref={appShellRef}>
      {tooltip && (
        <div
          className={`accessible-tooltip ${tooltip.below ? "below" : ""}`}
          style={{ left: tooltip.left, top: tooltip.top }}
          role="tooltip"
        >
          {tooltip.text}
        </div>
      )}
      {updateAvailable && (
        <div className="update-banner" role="status">
          <span><b>Barcode Generator update available.</b> Refresh to use the latest version.</span>
          <button type="button" onClick={() => window.location.reload()}>Refresh now</button>
        </div>
      )}
      <header className="topbar">
        <strong className="product-category">Print-ready barcode maker</strong>
        <div className="topbar-note"><span>GS1-aware</span><i /> SVG + PNG</div>
      </header>

      <section className="hero" id="top">
        <div>
          <a className="brand hero-brand" href="#top" aria-label="Barcode Generator home">
            <span className="brand-mark" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
            </span>
            <span>BARCODE GENERATOR</span>
          </a>
          <h1>Print-ready<br />barcodes.</h1>
        </div>
        <p className="hero-copy">
          Generate standards-aware barcodes with protected quiet zones, automatic check digits,
          and exports sized for real artwork.
        </p>
      </section>

      <section className="type-picker" aria-labelledby="type-heading">
        <div className="section-kicker">
          <span>01</span>
          <h2 id="type-heading">Choose a code</h2>
        </div>
        <div className="type-grid">
          {BARCODE_TYPES.map((item) => (
            <button
              className={`type-button ${kind === item.id ? "active" : ""}`}
              type="button"
              key={item.id}
              onClick={() => selectKind(item.id)}
              aria-pressed={kind === item.id}
            >
              <small>{item.family}</small>
              <strong>{item.shortLabel}</strong>
              <em className="type-capability">{item.contentLabel}</em>
              <span>{item.description}</span>
            </button>
          ))}
        </div>
        <div className="usage-note">
          <Info size={17} />
          <p>
            <b>No DENSO fee for the QR-family formats included here.</b>{" "}
            DENSO permits standards-compliant QR Code use without a licence contract or fee, calls
            Micro QR public domain, and describes rMQR as freely usable. iQR, SQRC, and FrameQR are
            not included because their terms, open browser tooling, or scanner reach are less clear.
            {" "}<a href={DENSO_QR_TERMS} target="_blank" rel="noreferrer">DENSO usage terms <ExternalLink size={12} /></a>
          </p>
        </div>
      </section>

      <div className="workspace-grid">
        <section className="controls-column" aria-label="Barcode settings">
          <div className="panel input-panel">
            <div className="panel-title">
              <div className="section-kicker">
                <span>02</span>
                <h2>Enter the data</h2>
              </div>
              <span className="type-pill">{type.label}</span>
            </div>

            <label className="field-label" htmlFor="barcode-data">
              {type.contentLabel}
            </label>
            <div className="field-memory">
              <span>
                {PORTABLE_2D_SET.has(kind) && shared2dTouched
                  ? "Saved in this browser · shared across compatible matrix and stacked codes"
                  : "Example for this format · saved in this browser"}
              </span>
              <button type="button" onClick={resetExamples}>Reset examples</button>
            </div>
            {type.multiline ? (
              <textarea
                id="barcode-data"
                className={`data-input ${inputHasError ? "invalid" : ""}`}
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder={type.placeholder}
                rows={3}
                spellCheck={false}
                aria-invalid={inputHasError}
                aria-describedby={capacity ? "barcode-input-status microqr-capacity" : "barcode-input-status"}
                aria-errormessage={hasCapacityError ? "microqr-capacity" : undefined}
              />
            ) : (
              <input
                id="barcode-data"
                className={`data-input ${inputHasError ? "invalid" : ""}`}
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder={type.placeholder}
                inputMode={isNumericKind(kind) ? "numeric" : "text"}
                spellCheck={false}
                aria-invalid={inputHasError}
                aria-describedby="barcode-input-status"
              />
            )}

            <div id="barcode-input-status" className={`validation-line ${inputHasError ? "error" : "ok"}`} aria-live="polite">
              {inputHasError ? <AlertTriangle size={16} /> : <Check size={16} />}
              <span>
                {dataError
                  ? dataError
                  : hasCapacityError && capacity
                    ? `${[...validation.encoded].length} characters · ${new TextEncoder().encode(validation.encoded).length} bytes entered. Micro QR capacity exceeded.`
                  : validation.generatedCheckDigit
                    ? `${type.label} uses ${validation.encoded.length} digits: your data plus check digit ${validation.checkDigit}, calculated automatically.`
                    : validation.checkDigit
                      ? `Check digit ${validation.checkDigit} is valid.`
                      : `${[...validation.encoded].length} characters · ${new TextEncoder().encode(validation.encoded).length} bytes encoded.`}
              </span>
            </div>

            {capacity && !dataError && (
              <div
                id="microqr-capacity"
                className={`capacity-panel ${!capacity.fits ? "over" : capacity.remaining <= Math.ceil(capacity.maximum * 0.2) ? "near" : "ok"}`}
                role="status"
                aria-live="polite"
                aria-atomic="true"
              >
                <div className="capacity-heading">
                  <div>
                    <b>{capacity.fits ? "Micro QR capacity" : "Micro QR capacity exceeded"}</b>
                    <strong>{capacityStatus}</strong>
                  </div>
                  <span>{capacity.mode === "numeric" ? "NUMERIC" : capacity.mode === "alphanumeric" ? "ALPHANUMERIC" : "BYTE MODE"}</span>
                </div>
                <meter
                  min="0"
                  max={capacity.maximum}
                  value={Math.min(capacity.used, capacity.maximum)}
                  aria-label={`Micro QR capacity: ${capacityStatus}`}
                />
                <p>
                  <span>
                    {capacity.currentVersion ? `Current symbol ${capacity.currentVersion}` : "Maximum version M4"}
                    {` · ${capacity.effectiveErrorCorrection} error correction · limit ${capacity.maximum} ${capacity.unit}`}
                  </span>
                  {capacity.fits
                    ? capacity.remaining <= Math.ceil(capacity.maximum * 0.2)
                      ? "Close to the limit. A different character type can change how efficiently the value is encoded."
                      : capacity.explanation
                    : `${capacity.explanation} Shorten it by at least ${formatCount(capacity.overBy, capacity.unit)}, or switch to QR, rMQR, or Data Matrix.`}
                </p>
              </div>
            )}

            {rendered && showCompleteCode && (
              <button className="encoded-value" type="button" onClick={copyEncoded}>
                <span>COMPLETE {rendered.encoded.length}-DIGIT CODE</span>
                <strong>{rendered.encoded}</strong>
                <small>{encodedCopied ? "COPIED" : "COPY"}</small>
                {encodedCopied ? <Check size={16} /> : <Copy size={16} />}
              </button>
            )}

            {validation.generatedCheckDigit && (
              <div className="check-digit-note">
                <Info size={16} />
                <span>
                  <b>Why the extra digit?</b> The final digit is a GS1 Mod 10 check digit. Starting from the right, the data digits are weighted 3, 1, 3, 1, then added together; the check digit brings that sum up to the next multiple of 10. For this code it is {validation.checkDigit}. It contains no additional product data; scanners use it to detect many typing and reading errors.
                </span>
              </div>
            )}

            <div className="format-context">
              <div>
                <b>{FORMAT_NOTES[kind].lead}</b>
                <span>{FORMAT_NOTES[kind].detail}</span>
              </div>
              {FORMAT_NOTES[kind].url && (
                <a href={FORMAT_NOTES[kind].url} target="_blank" rel="noreferrer">
                  {FORMAT_NOTES[kind].source} <ExternalLink size={12} />
                </a>
              )}
            </div>
          </div>

          <div className="panel size-panel">
            <div className="size-heading">
              <div className="section-kicker">
                <span>03</span>
                <h2>Set the print size</h2>
              </div>
            </div>

            {kind === "rmqr" && (
              <fieldset className="rmqr-layout" aria-describedby="rmqr-layout-help">
                <legend>rMQR layout</legend>
                <p id="rmqr-layout-help">
                  rMQR uses 32 fixed standard grids. Choose one automatically, fit one inside your available space, or select an exact version. Modules always stay square.
                </p>
                <div className="rmqr-mode-grid">
                  {([
                    ["auto", "Automatic", "Best standard grid"],
                    ["fit", "Fit inside box", "Maximum width + height"],
                    ["exact", "Exact version", "Advanced control"],
                  ] as const).map(([mode, label, detail]) => (
                    <label key={mode} className={rmqrMode === mode ? "active" : ""}>
                      <input
                        type="radio"
                        name="rmqr-layout-mode"
                        value={mode}
                        checked={rmqrMode === mode}
                        onChange={() => selectRmqrMode(mode)}
                      />
                      <span className="radio-dot" aria-hidden="true" />
                      <b>{label}</b>
                      <small>{detail}</small>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}

            {usesAutomaticPrintSize && (
              <>
                <div className="preset-grid" role="group" aria-label="Size preset">
                  <button
                    type="button"
                    className={preset === "target" ? "active" : ""}
                    onClick={() => selectPreset("target")}
                  >
                    <span className="radio-dot" />
                    <b>Recommended</b>
                    <div className="preset-spec-row">
                      <em>{hasGs1Preset ? "GS1 TARGET" : hasGs1Retail2dReference ? "GS1 POS TARGET" : "GENERAL USE"}</em>
                      <span>{shortDimensionName} {guidance.targetX.toFixed(3)} mm</span>
                    </div>
                    <small>{formatLabeledDimensions(presetMeasurements.target)} total</small>
                  </button>
                  <button
                    type="button"
                    className={preset === "compact" ? "active" : ""}
                    onClick={() => selectPreset("compact")}
                  >
                    <span className="radio-dot" />
                    <b>{kind === "itf14" ? "Label minimum" : "Small pack"}</b>
                    <div className="preset-spec-row">
                      <em>{hasGs1Preset ? "GS1 MIN" : hasGs1Retail2dReference ? "GS1 POS MIN" : "TIGHT SPACE"}</em>
                      <span>{shortDimensionName} {guidance.compactX.toFixed(3)} mm</span>
                    </div>
                    <small>{formatLabeledDimensions(presetMeasurements.compact)} total</small>
                  </button>
                  <button
                    type="button"
                    className={preset === "custom" ? "active" : ""}
                    onClick={() => selectPreset("custom")}
                  >
                    <span className="radio-dot" />
                    <b>Custom</b>
                    <div className="preset-spec-row"><em>MANUAL</em></div>
                    <small>Use with care</small>
                  </button>
                </div>

                <div className="preset-explanation">
                  {preset === "target" && (
                    <>
                      <b>{hasGs1Preset ? "GS1 target" : hasGs1Retail2dReference ? "GS1 retail POS target" : "General-use size"}</b>
                      <span>
                        The normal first choice for reliable printing and scanning. {SIZE_SOURCES[kind].summary}
                        {SIZE_SOURCES[kind].url && <>{" "}<a href={SIZE_SOURCES[kind].url} target="_blank" rel="noreferrer">Open reference <ExternalLink size={12} /></a></>}
                      </span>
                    </>
                  )}
                  {preset === "compact" && (
                    <>
                      <b>{hasGs1Preset ? "GS1 minimum" : hasGs1Retail2dReference ? "GS1 retail POS minimum" : "Tight-space size"}</b>
                      <span>
                        For space-constrained artwork. Treat this as a floor, not a target. {SIZE_SOURCES[kind].summary}
                        {SIZE_SOURCES[kind].url && <>{" "}<a href={SIZE_SOURCES[kind].url} target="_blank" rel="noreferrer">Open reference <ExternalLink size={12} /></a></>}
                      </span>
                    </>
                  )}
                  {preset === "custom" && <><b>Manual size</b><span>Enter {hasSquareOutput ? "the total output size" : "total output width"} or {type.linear ? "X-dimension" : "module size"}. The tool keeps the quiet zone in the export.</span></>}
                </div>

                {preset === "custom" && (
                  <div className="custom-size-tools">
                    <div className="measure-toggle" role="group" aria-label="Custom size input">
                      <button type="button" className={customMeasure === "width" ? "active" : ""} onClick={() => {
                        if (rendered) setCustomWidth(Number(rendered.widthMm.toFixed(2)));
                        setCustomMeasure("width");
                      }}>{hasSquareOutput ? "Total size" : "Total width"}</button>
                      {!type.linear && !hasSquareOutput && <button type="button" className={customMeasure === "height" ? "active" : ""} onClick={() => {
                        if (rendered) setCustomTotalHeight(Number(rendered.heightMm.toFixed(2)));
                        setCustomMeasure("height");
                      }}>Total height</button>}
                      <button type="button" className={customMeasure === "x" ? "active" : ""} onClick={() => setCustomMeasure("x")}>{dimensionName}</button>
                    </div>
                    <div className="custom-size-row">
                      {effectiveCustomMeasure === "width" ? (
                        <label>
                          <span>{hasSquareOutput ? "Total output size" : "Total output width"}</span>
                          <div><input aria-invalid={isPrintSizeError} type="number" min="0.1" max={kind === "itf14" ? 138 : 250} step="0.1" value={customWidth} onChange={(event) => setCustomWidth(Number(event.target.value))} /><b>mm</b></div>
                        </label>
                      ) : effectiveCustomMeasure === "height" ? (
                        <label>
                          <span>Total output height</span>
                          <div><input aria-invalid={isPrintSizeError} type="number" min="0.1" max="250" step="0.1" value={customTotalHeight} onChange={(event) => setCustomTotalHeight(Number(event.target.value))} /><b>mm</b></div>
                        </label>
                      ) : (
                        <label>
                          <span>{dimensionName}</span>
                          <div><input aria-invalid={isPrintSizeError} type="number" min="0.1" max="2" step="0.001" value={customX} onChange={(event) => setCustomX(Number(event.target.value))} /><b>mm</b></div>
                        </label>
                      )}
                      <p>{effectiveCustomMeasure === "width" ? kind === "itf14" ? "Includes quiet zones. Maximum 138 mm with standards-sized bearer bars." : hasSquareOutput ? "Sets both width and height, including the required quiet zone." : "Includes the required quiet zone." : effectiveCustomMeasure === "height" ? "Includes the required quiet zone. Width changes proportionally so modules remain square." : type.linear || kind === "pdf417" ? "The width of the narrowest bar." : "The physical width of one square module."}</p>
                    </div>
                  </div>
                )}
              </>
            )}

            {kind === "rmqr" && rmqrMode === "fit" && (
              <div className="rmqr-settings" aria-describedby="rmqr-fit-help">
                <div className="rmqr-settings-heading">
                  <b>Available print area</b>
                  <span>AUTO-FIT</span>
                </div>
                <div className="rmqr-field-grid">
                  <label className="rmqr-field">
                    <span>Maximum width</span>
                    <div><input aria-invalid={rmqrMaxWidth <= 0} type="number" min="1" max="500" step="0.1" value={rmqrMaxWidth} onChange={(event) => setRmqrMaxWidth(Number(event.target.value))} /><b>mm</b></div>
                  </label>
                  <label className="rmqr-field">
                    <span>Maximum height</span>
                    <div><input aria-invalid={rmqrMaxHeight <= 0} type="number" min="1" max="500" step="0.1" value={rmqrMaxHeight} onChange={(event) => setRmqrMaxHeight(Number(event.target.value))} /><b>mm</b></div>
                  </label>
                  <label className="rmqr-field">
                    <span>Minimum module</span>
                    <div><input aria-invalid={rmqrMinX <= 0} type="number" min="0.1" max="2" step="0.001" value={rmqrMinX} onChange={(event) => setRmqrMinX(Number(event.target.value))} /><b>mm</b></div>
                  </label>
                </div>
                <p className="rmqr-help" id="rmqr-fit-help">Limits apply to the final rotated output and include the required 2-module quiet zone. Barcode Generator tests all 32 grids and chooses the one with the largest possible square module.</p>
                {rendered && (
                  <p className="rmqr-result" aria-live="polite">
                    <Check size={15} /> Fits inside {formatMm(rmqrMaxWidth)} × {formatMm(rmqrMaxHeight)} mm. Using <b>{formatRmqrVersion(rendered.rmqrVersion ?? "")}</b> with <b>{rendered.xDimension.toFixed(3)} mm</b> modules. Final output: <b>{formatDimensions(rendered)}</b>.
                  </p>
                )}
              </div>
            )}

            {kind === "rmqr" && rmqrMode === "exact" && (
              <div className="rmqr-settings" aria-describedby="rmqr-exact-help">
                <div className="rmqr-settings-heading">
                  <b>Exact standard grid</b>
                  <span>ADVANCED</span>
                </div>
                <div className="rmqr-exact-grid">
                  <label className="rmqr-version-field">
                    <span>rMQR version</span>
                    <div>
                      <select value={rmqrVersion} onChange={(event) => setRmqrVersion(event.target.value as RmqrVersion)}>
                        {[7, 9, 11, 13, 15, 17].map((rows) => (
                          <optgroup key={rows} label={`${rows} rows`}>
                            {RMQR_VERSIONS.filter((version) => version.rows === rows).map((version) => (
                              <option key={version.id} value={version.id}>{formatRmqrVersion(version.id)} · {version.rows} rows × {version.columns} columns</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                      <ChevronDown size={15} />
                    </div>
                  </label>
                  <label className="rmqr-field">
                    <span>Module size</span>
                    <div><input aria-invalid={customX <= 0} type="number" min="0.1" max="2" step="0.001" value={customX} onChange={(event) => setCustomX(Number(event.target.value))} /><b>mm</b></div>
                  </label>
                </div>
                <p className="rmqr-help" id="rmqr-exact-help">The version fixes the row and column count. Module size controls the physical output, while every module remains square. If the value does not fit, Barcode Generator keeps your selection and disables export.</p>
                {rendered && (
                  <p className="rmqr-result" aria-live="polite">
                    <Check size={15} /> <b>{formatRmqrVersion(rendered.rmqrVersion ?? "")}</b> at <b>{rendered.xDimension.toFixed(3)} mm</b> per module. Final output: <b>{formatDimensions(rendered)}</b>.
                  </p>
                )}
              </div>
            )}

            {type.linear && (
              <div className="height-control">
                <div>
                  <span className="height-title">Bar height <small>{limitHeight ? "HEIGHT LIMITED" : "STANDARD"}</small></span>
                  <p>Keep the recommended X-dimension and shorten only when the artwork forces it. Shorter bars scan from fewer angles.</p>
                </div>
                <label className="height-toggle">
                  <input type="checkbox" checked={limitHeight} onChange={(event) => {
                    if (event.target.checked) setHeightLimit(roundEditableMm(rendered?.barHeight ?? guidance.targetHeight ?? 15));
                    setLimitHeight(event.target.checked);
                  }} />
                  <span className="height-checkbox" aria-hidden="true" />
                  <b>Limit height</b>
                </label>
                {limitHeight && (
                  <label className="height-limit-field">
                    <span>Bar height</span>
                    <div><input type="number" min="3" max="80" step="0.01" value={heightLimit} onChange={(event) => setHeightLimit(roundEditableMm(Number(event.target.value)))} /><b>mm</b></div>
                  </label>
                )}
              </div>
            )}

            {(type.linear || type.rotatable || kind === "qr" || kind === "microqr" || kind === "rmqr" || kind === "datamatrix") && (
            <div className="options-row">
              {type.linear && (
                <label className="switch-control">
                  <input type="checkbox" checked={includeText} onChange={(event) => setIncludeText(event.target.checked)} />
                  <span aria-hidden="true" />
                  <b>
                    {isNumericKind(kind) ? "Human-readable digits" : "Human-readable text"}
                    {isNumericKind(kind) && <small>OCR-B</small>}
                  </b>
                </label>
              )}
              {(kind === "qr" || kind === "microqr" || kind === "rmqr") && (
                <label className="select-control">
                  <span>Error correction</span>
                  <select
                    value={errorCorrection}
                    onChange={(event) => {
                      if (kind === "rmqr") setRmqrErrorCorrection(event.target.value as "M" | "H");
                      else if (kind === "microqr") setMicroQrErrorCorrection(event.target.value as "L" | "M" | "Q");
                      else setQrErrorCorrection(event.target.value as "L" | "M" | "Q" | "H");
                    }}
                  >
                    {kind !== "rmqr" && <option value="L">L · about 7%</option>}
                    <option value="M">M · about 15%</option>
                    {kind !== "rmqr" && <option value="Q">Q · about 25%</option>}
                    {kind !== "microqr" && <option value="H">H · about 30%</option>}
                  </select>
                  <ChevronDown size={15} />
                </label>
              )}
              {kind === "rmqr" && rmqrMode === "auto" && (
                <label className="select-control">
                  <span>Automatic choice</span>
                  <select value={rmqrShape} onChange={(event) => setRmqrShape(event.target.value as "compact" | "low-profile")}>
                    <option value="low-profile">Lowest profile</option>
                    <option value="compact">Smallest area</option>
                  </select>
                  <ChevronDown size={15} />
                </label>
              )}
              {kind === "datamatrix" && (
                <div className="shape-control" role="group" aria-label="Data Matrix shape">
                  <span>Shape</span>
                  <div>
                    <button
                      type="button"
                      className={dataMatrixShape === "square" ? "active" : ""}
                      aria-label="Square Data Matrix"
                      aria-pressed={dataMatrixShape === "square"}
                      data-tooltip="Use a square Data Matrix symbol"
                      onClick={() => setDataMatrixShape("square")}
                    >
                      <Square size={19} strokeWidth={2.2} />
                    </button>
                    <button
                      type="button"
                      className={dataMatrixShape === "rectangle" ? "active" : ""}
                      aria-label="Rectangular Data Matrix"
                      aria-pressed={dataMatrixShape === "rectangle"}
                      data-tooltip="Use a rectangular Data Matrix symbol"
                      onClick={() => setDataMatrixShape("rectangle")}
                    >
                      <RectangleHorizontal size={22} strokeWidth={2.2} />
                    </button>
                  </div>
                </div>
              )}
              {type.rotatable && (
                <div className="rotation-control" role="group" aria-label="Rotation">
                  <span><RotateCw size={15} /> Rotation</span>
                  <div>
                    <button type="button" className={rotation === "N" ? "active" : ""} aria-pressed={rotation === "N"} onClick={() => setRotation("N")}>0°</button>
                    <button type="button" className={rotation === "R" ? "active" : ""} aria-pressed={rotation === "R"} onClick={() => setRotation("R")}>90°</button>
                  </div>
                </div>
              )}
            </div>
            )}

            {(kind === "qr" || kind === "microqr" || kind === "rmqr") && (
              <div className="correction-note">
                <Info size={17} />
                <p>
                  <b>M is the balanced default.</b> Higher correction adds redundant data so a damaged code can still be read, but it leaves less room for content. {kind === "qr" ? "QR offers L, M, Q, and H." : kind === "microqr" ? "Micro QR offers L, M, and Q, depending on its version." : "rMQR offers M and H."}
                  {kind === "qr" && rendered?.moduleColumns && <> Current result: version {(rendered.moduleColumns - 17) / 4}, {rendered.moduleColumns} × {rendered.moduleRows} modules, EC {errorCorrection}. Short values can keep the same outer grid at every level even though the internal module pattern changes.</>}
                  <a href={kind === "qr" ? "https://www.qrcode.com/en/about/error_correction.html#errorCorrectionContents" : kind === "microqr" ? DENSO_MICRO_QR_CAPACITY : DENSO_RMQR} target="_blank" rel="noreferrer">Error correction reference <ExternalLink size={12} /></a>
                </p>
              </div>
            )}

            {settingsError && !hasCapacityError && (
              <div className="settings-error" role="alert">
                <AlertTriangle size={18} />
                <div><b>{settingsErrorTitle}</b><span>{settingsError}</span></div>
              </div>
            )}

            <div className="protected-note">
              <Info size={18} />
              <div>
                <b>Quiet zones are protected</b>
                <span>{guidance.standard}. The export includes this clear space automatically.</span>
              </div>
            </div>
          </div>
        </section>

        <aside className="preview-column" aria-label="Barcode preview">
          <div className="preview-card">
            <div className="preview-header">
              <h2>Preview</h2>
              {previewMetadata && <span className="preview-type">{previewMetadata}</span>}
            </div>

            <div className="artboard-wrap">
              {rendered && (
                <p className="preview-scale-note">* Preview always scaled to fit. The white rectangle is the complete export, including its protected quiet zone.</p>
              )}
              <div className="artboard">
                {rendered ? (
                  <div className="preview-symbol-frame" style={previewSymbolStyle}>
                    <div className={`barcode-output ${type.linear ? "linear" : "matrix"}`} dangerouslySetInnerHTML={{ __html: rendered.svg }} />
                    <div className="dimension-guide dimension-guide-x">
                      {horizontalRuler?.ticks.map((tick) => (
                        <span
                          className={`ruler-tick ${tick.major ? "major" : "minor"} ${tick.position === 0 ? "edge-start" : ""} ${tick.position === 100 ? "edge-end" : ""}`}
                          aria-hidden="true"
                          key={`${tick.valueMm}-${tick.position}`}
                          style={{ left: `${tick.position}%` }}
                        >
                          {tick.label !== undefined && <b>{tick.label}</b>}
                        </span>
                      ))}
                      {dimensionEdit === "width" ? (
                        <span className={`dimension-total dimension-editor ${dimensionEditError ? "error" : ""}`}>
                          <b>W</b>
                          <input
                            ref={dimensionInputRef}
                            type="text"
                            inputMode="decimal"
                            value={dimensionDraft}
                            aria-label="Output width in millimetres"
                            aria-invalid={Boolean(dimensionEditError)}
                            aria-describedby={dimensionEditError ? "dimension-edit-error" : undefined}
                            onFocus={(event) => event.currentTarget.select()}
                            onChange={(event) => {
                              setDimensionDraft(event.target.value);
                              setDimensionEditError(null);
                            }}
                            onBlur={() => {
                              setDimensionEdit(null);
                              setDimensionEditError(null);
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                commitDimensionEdit("width");
                              } else if (event.key === "Escape") {
                                setDimensionEdit(null);
                                setDimensionEditError(null);
                              }
                            }}
                          />
                          <i>mm</i>
                          {!hasSquareOutput && (
                            <button
                              type="button"
                              className={`dimension-link ${dimensionsLinked ? "active" : ""}`}
                              aria-label={dimensionsLinked ? "Unlock proportions" : "Lock proportions"}
                              aria-pressed={dimensionsLinked}
                              data-tooltip={dimensionsLinked ? "Proportions locked. Width and height scale together." : "Proportions unlocked. Edit one dimension independently."}
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => setDimensionsLinked((linked) => !linked)}
                            >
                              {dimensionsLinked ? <Link2 size={13} /> : <Unlink2 size={13} />}
                            </button>
                          )}
                        </span>
                      ) : (
                        <button type="button" className="dimension-total" onClick={() => beginDimensionEdit("width")} aria-label={`Edit output width, currently ${formatMm(rendered.widthMm)} millimetres`}>W {formatRulerDimension(rendered.widthMm, horizontalRuler?.unit ?? "mm")}</button>
                      )}
                    </div>
                    <div className="dimension-guide dimension-guide-y">
                      {verticalRuler?.ticks.map((tick) => (
                        <span
                          className={`ruler-tick ${tick.major ? "major" : "minor"} ${tick.position === 0 ? "edge-start" : ""} ${tick.position === 100 ? "edge-end" : ""}`}
                          aria-hidden="true"
                          key={`${tick.valueMm}-${tick.position}`}
                          style={{ top: `${tick.position}%` }}
                        >
                          {tick.label !== undefined && <b>{tick.label}</b>}
                        </span>
                      ))}
                      {dimensionEdit === "height" ? (
                        <span className={`dimension-total dimension-editor ${dimensionEditError ? "error" : ""}`}>
                          <b>H</b>
                          <input
                            ref={dimensionInputRef}
                            type="text"
                            inputMode="decimal"
                            value={dimensionDraft}
                            aria-label="Output height in millimetres"
                            aria-invalid={Boolean(dimensionEditError)}
                            aria-describedby={dimensionEditError ? "dimension-edit-error" : undefined}
                            onFocus={(event) => event.currentTarget.select()}
                            onChange={(event) => {
                              setDimensionDraft(event.target.value);
                              setDimensionEditError(null);
                            }}
                            onBlur={() => {
                              setDimensionEdit(null);
                              setDimensionEditError(null);
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                commitDimensionEdit("height");
                              } else if (event.key === "Escape") {
                                setDimensionEdit(null);
                                setDimensionEditError(null);
                              }
                            }}
                          />
                          <i>mm</i>
                          {!hasSquareOutput && (
                            <button
                              type="button"
                              className={`dimension-link ${dimensionsLinked ? "active" : ""}`}
                              aria-label={dimensionsLinked ? "Unlock proportions" : "Lock proportions"}
                              aria-pressed={dimensionsLinked}
                              data-tooltip={dimensionsLinked ? "Proportions locked. Width and height scale together." : "Proportions unlocked. Edit one dimension independently."}
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => setDimensionsLinked((linked) => !linked)}
                            >
                              {dimensionsLinked ? <Link2 size={13} /> : <Unlink2 size={13} />}
                            </button>
                          )}
                        </span>
                      ) : (
                        <button type="button" className="dimension-total" onClick={() => beginDimensionEdit("height")} aria-label={`Edit output height, currently ${formatMm(rendered.heightMm)} millimetres`}>H {formatRulerDimension(rendered.heightMm, verticalRuler?.unit ?? "mm")}</button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="preview-error">
                    <AlertTriangle size={28} />
                    <b>{dataError ? "Check the data" : settingsErrorTitle}</b>
                    <span>{previewError ?? "This symbol cannot encode the current value."}</span>
                  </div>
                )}
                {dimensionEditError && <div className="dimension-edit-message" id="dimension-edit-error" role="alert">{dimensionEditError}</div>}
              </div>
            </div>

            {rendered && (
              <div className={`measurement-strip ${hasErrorCorrectionMetric ? "has-four" : ""}`}>
                <div><span>{kind === "rmqr" ? "Final size" : "Output size"}</span><b>{formatMm(rendered.widthMm)} × {formatMm(rendered.heightMm)} mm</b></div>
                <div><span>{dimensionName}</span><b>{rendered.xDimension.toFixed(3)} mm</b></div>
                {rendered.moduleColumns && rendered.moduleRows && (
                  <div>
                    <span>{kind === "rmqr" ? "Version" : "Symbol grid"}</span>
                    <b>
                      {kind === "rmqr" && rendered.rmqrVersion
                        ? `${formatRmqrVersion(rendered.rmqrVersion)} · ${rotation === "R" ? rendered.moduleColumns : rendered.moduleRows} × ${rotation === "R" ? rendered.moduleRows : rendered.moduleColumns} grid${rotation === "R" ? " · rotated" : ""}`
                        : `${rendered.moduleColumns} × ${rendered.moduleRows} modules`}
                    </b>
                  </div>
                )}
                {hasErrorCorrectionMetric && (
                  <div><span>Error correction</span><b>{errorCorrection} · about {ERROR_CORRECTION_PERCENT[errorCorrection]}%</b></div>
                )}
              </div>
            )}

            {physicalWarning && (
              <div className={`warning-note ${physicalWarning.severity}`}><AlertTriangle size={17} /><span>{physicalWarning.message}</span></div>
            )}

            <div className="export-area">
              <div className="svg-export-card export-card">
                <div className="export-format-heading export-card-heading">
                  <div><b>SVG</b><span>Vector image</span></div>
                </div>
                <div className="export-setting-row">
                  <span className="export-setting-label">Size embedded in millimetres</span>
                </div>
                <p className="export-detail-note">Vector artwork · no raster DPI</p>
                <div className="export-actions">
                  <button className="primary-download" type="button" onClick={downloadSvg} disabled={!rendered}>
                    <ArrowDownToLine size={18} /> Download SVG
                  </button>
                  <button className="copy-export-button" type="button" onClick={copySvg} disabled={!rendered}>
                    {svgCopyStatus === "idle" || svgCopyStatus === "error" ? <Copy size={18} /> : <Check size={18} />}
                    {svgCopyStatus === "vector" ? "Copied SVG" : svgCopyStatus === "source" ? "SVG code copied" : svgCopyStatus === "error" ? "Could not copy" : "Copy SVG"}
                  </button>
                </div>
              </div>
              <div className="png-export-card export-card">
                <div className="export-format-heading export-card-heading">
                  <div><b>PNG</b><span>Raster image</span></div>
                </div>
                <div className="export-setting-row">
                  <span className="export-setting-label" id="png-resolution-label">PNG resolution (DPI)</span>
                  <div className="png-control" role="group" aria-labelledby="png-resolution-label">
                    {DPI_OPTIONS.map((option) => (
                      <button
                        key={option}
                        type="button"
                        className={dpi === option ? "active" : ""}
                        onClick={() => setDpi(option)}
                        aria-pressed={dpi === option}
                        aria-label={`${option} DPI`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="export-detail-note">
                  {rendered ? `${pngWidth.toLocaleString()} × ${pngHeight.toLocaleString()} px at ${dpi} DPI` : "Resolution applies only to PNG."}
                </p>
                <div className="export-actions">
                  <button className="secondary-download" type="button" onClick={downloadPng} disabled={!rendered}>
                    <ArrowDownToLine size={19} /> Download PNG
                  </button>
                  <button className="copy-export-button" type="button" onClick={copyPng} disabled={!rendered}>
                    {pngCopyStatus === "copied" ? <Check size={18} /> : <Copy size={18} />}
                    {pngCopyStatus === "copied" ? "Copied PNG" : pngCopyStatus === "unsupported" ? "Copy unavailable" : pngCopyStatus === "error" ? "Could not copy" : "Copy PNG"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>

      <section className="guide-section">
        <button className="guide-toggle" type="button" onClick={() => setGuideOpen(!guideOpen)} aria-expanded={guideOpen}>
          <span><Info size={18} /> Which size should I use?</span>
          <span>{kind === "rmqr" ? "rMQR sizing guide" : "Compare presets"} <ChevronDown className={guideOpen ? "open" : ""} size={18} /></span>
        </button>
        {guideOpen && (
          <div className="guide-body">
            <p className="guide-summary">
              {kind === "rmqr"
                ? "rMQR does not allow arbitrary row and column counts. It has 32 standard grids, and the physical size comes from that grid plus the quiet zone, multiplied by one square module size."
                : `Sizes below are calculated for the current ${type.label} and data. Start with Recommended. Use Small pack only when space is genuinely tight, and test the finished print.`}
            </p>
            {kind === "rmqr" ? (
              <div className="guide-content">
                <article>
                  <span className="guide-number">01 · SIMPLE</span>
                  <h3>Automatic</h3>
                  <strong>Choose lowest profile or smallest area</strong>
                  <p>Barcode Generator selects the smallest valid standard grid for that goal. Recommended, Small pack, and Custom then control its physical module size.</p>
                  <a href={DENSO_RMQR} target="_blank" rel="noreferrer">rMQR standard grids <ExternalLink size={12} /></a>
                </article>
                <article>
                  <span className="guide-number">02 · ARTWORK CONSTRAINT</span>
                  <h3>Fit inside box</h3>
                  <strong>Maximum width + maximum height</strong>
                  <p>Every valid grid is tested. The winner is the one that fits both final dimensions with the largest square modules, including the 2-module quiet zone.</p>
                  <a href={DENSO_RMQR} target="_blank" rel="noreferrer">rMQR size reference <ExternalLink size={12} /></a>
                </article>
                <article>
                  <span className="guide-number">03 · ADVANCED</span>
                  <h3>Exact version</h3>
                  <strong>One of 32 grids + module size</strong>
                  <p>Use when a workflow specifies an rMQR version. If that grid cannot hold the current data and correction level, export stays disabled instead of substituting another version.</p>
                  <a href={DENSO_RMQR} target="_blank" rel="noreferrer">rMQR version reference <ExternalLink size={12} /></a>
                </article>
              </div>
            ) : (
              <div className="guide-content">
                <article>
                  <span className="guide-number">01 · {hasGs1Preset ? "GS1 TARGET" : hasGs1Retail2dReference ? "GS1 POS TARGET" : "GENERAL USE"}</span>
                  <h3>Recommended</h3>
                  <strong>{formatDimensions(presetMeasurements.target)}</strong>
                  <p>Best default for new artwork. It uses the target {type.linear ? "X-dimension and normal bar height" : "module size"}, giving a stronger everyday scanning margin.</p>
                  {SIZE_SOURCES[kind].url && <a href={SIZE_SOURCES[kind].url} target="_blank" rel="noreferrer">Preset size reference <ExternalLink size={12} /></a>}
                </article>
                <article>
                  <span className="guide-number">02 · {hasGs1Preset ? "GS1 MIN" : hasGs1Retail2dReference ? "GS1 POS MIN" : "TIGHT SPACE"}</span>
                  <h3>Small pack</h3>
                  <strong>{formatDimensions(presetMeasurements.compact)}</strong>
                  <p>
                    {hasGs1Preset
                      ? `The smallest GS1 size offered here for this application. Use it only when the package cannot fit the target size, and test the finished print.`
                      : hasGs1Retail2dReference
                        ? `The GS1 minimum reference for retail POS use. It applies only when the data and syntax match the relevant GS1 profile, not arbitrary ${type.label} content.`
                        : `A tight-space setting rather than a universal standard. Test the finished print with the scanners that will actually read it.`}
                  </p>
                  {SIZE_SOURCES[kind].url && <a href={SIZE_SOURCES[kind].url} target="_blank" rel="noreferrer">Minimum size reference <ExternalLink size={12} /></a>}
                </article>
                <article>
                  <span className="guide-number">03 · MANUAL</span>
                  <h3>Custom</h3>
                  <strong>Exact width or {type.linear ? "X-dimension" : "module size"}</strong>
                  <p>Use for an exact artwork constraint. Barcode Generator preserves the required quiet zone and warns when the result falls below the compact reference.</p>
                  {SIZE_SOURCES[kind].url && <a href={SIZE_SOURCES[kind].url} target="_blank" rel="noreferrer">Sizing and quiet-zone reference <ExternalLink size={12} /></a>}
                </article>
              </div>
            )}
            <div className="guide-rule">
              <b>For every option</b>
              <span>Do not stretch one axis. Print at 100%, keep dark-on-light contrast, use non-reflective material, preserve the blank edge, and scan the finished pack.</span>
            </div>
          </div>
        )}
      </section>

      <section className="guide-section format-guide-section">
        <button className="guide-toggle" type="button" onClick={() => setFormatGuideOpen(!formatGuideOpen)} aria-expanded={formatGuideOpen}>
          <span><Info size={18} /> QR, Micro QR, rMQR, or iQR?</span>
          <span>Format and usage guide <ChevronDown className={formatGuideOpen ? "open" : ""} size={18} /></span>
        </button>
        {formatGuideOpen && (
          <div className="guide-body">
            <p className="guide-summary">
              Normal QR is the safe default. Micro QR minimizes total square area for very short content. rMQR minimizes height and fits a long, narrow edge. iQR can be even denser, but it is not offered here because maintained browser encoding and everyday scanner support are much weaker.
            </p>
            <div className="format-comparison">
              <article>
                <span>PHONE-FRIENDLY</span>
                <h3>QR Code</h3>
                <b>Best general compatibility</b>
                <p>Square, starts at 21 × 21 modules, handles links and larger payloads.</p>
                <a href="https://www.qrcode.com/en/about/#featureArea" target="_blank" rel="noreferrer">QR Code details <ExternalLink size={12} /></a>
              </article>
              <article>
                <span>SMALLEST SQUARE</span>
                <h3>Micro QR</h3>
                <b>Best for very short content</b>
                <p>Starts at 11 × 11 modules. It can beat rMQR in total area, but fewer scanners support it.</p>
                <a href={DENSO_MICRO_QR} target="_blank" rel="noreferrer">Micro QR details <ExternalLink size={12} /></a>
              </article>
              <article>
                <span>THIN RECTANGLE · INCLUDED</span>
                <h3>rMQR</h3>
                <b>Best for a narrow side panel</b>
                <p>From 7 × 43 to 17 × 139 modules. ISO-standard and the standards-based rectangular choice here.</p>
                <a href={DENSO_RMQR} target="_blank" rel="noreferrer">rMQR details <ExternalLink size={12} /></a>
              </article>
              <article>
                <span>NOT INCLUDED</span>
                <h3>iQR</h3>
                <b>Potentially denser, less portable</b>
                <p>DENSO lists 9 × 9 square and 5 × 19 rectangular symbols, but open web encoders and ordinary scanner support are scarce.</p>
                <a href={DENSO_IQR} target="_blank" rel="noreferrer">DENSO iQR details <ExternalLink size={12} /></a>
              </article>
            </div>
            <div className="licensing-rule">
              <div>
                <b>DENSO usage terms</b>
                <span>DENSO states that standards-compliant QR Code can be used commercially without an application, licence contract, or fee, and describes rMQR as freely usable. “QR Code” is a registered trademark of DENSO WAVE INCORPORATED.</span>
              </div>
              <div>
                <b>How this site generates codes</b>
                <span>Everything is rendered in your browser with the MIT-licensed bwip-js library. Proprietary SQRC and FrameQR are intentionally excluded.</span>
              </div>
              <div className="licensing-links">
                <a href={DENSO_QR_TERMS} target="_blank" rel="noreferrer">QR terms <ExternalLink size={12} /></a>
                <a href="https://www.denso-wave.com/en/adcd/info/detail__220525.html" target="_blank" rel="noreferrer">rMQR release <ExternalLink size={12} /></a>
                <a href="https://github.com/metafloor/bwip-js/blob/master/LICENSE" target="_blank" rel="noreferrer">Encoder licence <ExternalLink size={12} /></a>
              </div>
            </div>
          </div>
        )}
      </section>

      {installCapability !== "hidden" && (
        <section className="pwa-install" aria-labelledby="pwa-install-heading">
          <div className="pwa-install-copy">
            <span>MOBILE APP</span>
            <h2 id="pwa-install-heading">Keep the studio on your phone.</h2>
            <p>Launch Barcode Generator from your Home Screen in its own clean window.</p>
          </div>
          <div className="pwa-install-action">
            <button type="button" onClick={installPwa}>
              <ArrowDownToLine size={18} />
              Install as PWA
            </button>
            {installMessage && <p role="status">{installMessage}</p>}
          </div>
        </section>
      )}

      <footer>
        <div className="footer-copy">
          <span className="footer-credit">Vibe coded with ❤️ by Alex in Prague 🇨🇿</span>
          <span>Everything is generated in your browser.</span>
        </div>
        <a
          className="footer-source"
          href="https://github.com/jerechinsky/barcode-generator"
          target="_blank"
          rel="noreferrer"
        >
          Source available on GitHub <ExternalLink size={12} />
        </a>
      </footer>
    </main>
  );
}

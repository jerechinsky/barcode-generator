export type ParsedDimension =
  | { action: "restore" }
  | { action: "apply"; value: number; belowMinimum: boolean }
  | { action: "error"; message: string };

export function parseGuidedDimension(
  draft: string,
  minimum: number,
  axis: "width" | "height",
): ParsedDimension {
  const normalized = draft.trim().replace(",", ".");
  if (!normalized) return { action: "restore" };

  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0) {
    return { action: "error", message: `Enter a ${axis} greater than 0 mm, or leave it empty to restore the preset.` };
  }
  return { action: "apply", value, belowMinimum: value + 1e-9 < minimum };
}

export function barHeightForOutputHeight(
  currentOutputHeight: number,
  currentBarHeight: number,
  requestedOutputHeight: number,
) {
  return requestedOutputHeight - (currentOutputHeight - currentBarHeight);
}

export function linearAxisControlsBarHeight(
  rotation: "N" | "R",
  axis: "width" | "height",
) {
  return rotation === "N" ? axis === "height" : axis === "width";
}

export function heightWarningSeverity(
  height: number,
  compactReference: number,
): "critical" | "caution" | null {
  if (!Number.isFinite(height) || !Number.isFinite(compactReference) || height >= compactReference) return null;
  return height < compactReference * 0.5 ? "critical" : "caution";
}

export function roundEditableMm(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

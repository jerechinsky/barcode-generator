export type RulerUnit = "mm" | "cm";

export type RulerTick = {
  valueMm: number;
  position: number;
  major: boolean;
  label?: string;
};

export type RulerScale = {
  unit: RulerUnit;
  ticks: RulerTick[];
};

const CENTIMETRE_THRESHOLD_MM = 50;
const MAX_LABEL_INTERVALS = 10;

function niceStepAtLeast(minimum: number) {
  if (minimum <= 1) return 1;
  const exponent = Math.floor(Math.log10(minimum));
  const magnitude = 10 ** exponent;
  const fraction = minimum / magnitude;
  const niceFraction = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return niceFraction * magnitude;
}

export function buildRulerScale(lengthMm: number, largestDimensionMm: number): RulerScale {
  if (!Number.isFinite(lengthMm) || lengthMm <= 0) return { unit: "mm", ticks: [] };

  const unit: RulerUnit = largestDimensionMm >= CENTIMETRE_THRESHOLD_MM ? "cm" : "mm";
  const minorStepMm = Math.max(unit === "cm" ? 10 : 1, niceStepAtLeast(lengthMm / 200));
  const adaptiveStepMm = niceStepAtLeast(largestDimensionMm / MAX_LABEL_INTERVALS);
  const labelStepMm = unit === "cm"
    ? Math.max(10, adaptiveStepMm)
    : largestDimensionMm > 15
      ? Math.max(5, adaptiveStepMm)
      : 1;
  const majorStepMm = unit === "cm" ? labelStepMm : Math.max(5, labelStepMm);
  const tickCount = Math.floor((lengthMm + Number.EPSILON) / minorStepMm);
  const ticks: RulerTick[] = [];

  for (let index = 0; index <= tickCount; index += 1) {
    const valueMm = index * minorStepMm;
    const major = valueMm % majorStepMm === 0;
    ticks.push({
      valueMm,
      position: valueMm / lengthMm * 100,
      major,
      label: valueMm % labelStepMm === 0
        ? String(unit === "cm" ? valueMm / 10 : valueMm)
        : undefined,
    });
  }

  const finalTick = ticks.at(-1);
  if (!finalTick || Math.abs(finalTick.valueMm - lengthMm) > 0.001) {
    ticks.push({ valueMm: lengthMm, position: 100, major: true });
  }

  return { unit, ticks };
}

export function formatRulerDimension(lengthMm: number, unit: RulerUnit): string {
  if (unit === "cm") {
    const centimetres = lengthMm / 10;
    return `${centimetres < 10 ? centimetres.toFixed(2) : centimetres.toFixed(1)} cm`;
  }
  return `${lengthMm < 10 ? lengthMm.toFixed(2) : lengthMm.toFixed(1)} mm`;
}

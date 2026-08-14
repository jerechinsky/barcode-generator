import assert from "node:assert/strict";
import test from "node:test";
import { buildRulerScale, formatRulerDimension } from "../app/ruler.ts";

test("uses millimetre ticks for compact artwork", () => {
  const ruler = buildRulerScale(14.52, 14.52);

  assert.equal(ruler.unit, "mm");
  assert.equal(ruler.ticks[0].label, "0");
  assert.equal(ruler.ticks.find((tick) => tick.valueMm === 5)?.label, "5");
  assert.equal(ruler.ticks.find((tick) => tick.valueMm === 5)?.major, true);
  assert.equal(ruler.ticks.find((tick) => tick.valueMm === 6)?.major, false);
  assert.equal(ruler.ticks.find((tick) => tick.valueMm === 6)?.label, "6");
  assert.equal(ruler.ticks.at(-1)?.valueMm, 14.52);
  assert.equal(ruler.ticks.at(-1)?.position, 100);
  assert.equal(formatRulerDimension(14.52, ruler.unit), "14.5 mm");
});

test("keeps millimetre notches but labels only 5 mm divisions on a long axis", () => {
  const ruler = buildRulerScale(40.9, 40.9);
  const shortCompanionAxis = buildRulerScale(8.25, 40.9);

  assert.equal(ruler.unit, "mm");
  assert.equal(ruler.ticks.find((tick) => tick.valueMm === 1)?.label, undefined);
  assert.equal(ruler.ticks.find((tick) => tick.valueMm === 5)?.label, "5");
  assert.equal(ruler.ticks.find((tick) => tick.valueMm === 35)?.label, "35");
  assert.equal(ruler.ticks.find((tick) => tick.valueMm === 40)?.label, "40");
  assert.equal(ruler.ticks.at(-1)?.valueMm, 40.9);
  assert.equal(shortCompanionAxis.ticks.find((tick) => tick.valueMm === 1)?.label, undefined);
  assert.equal(shortCompanionAxis.ticks.find((tick) => tick.valueMm === 5)?.label, "5");
});

test("switches both axes to centimetre divisions when either dimension is large", () => {
  const horizontal = buildRulerScale(121, 121);
  const vertical = buildRulerScale(38.7, 121);

  assert.equal(horizontal.unit, "cm");
  assert.equal(vertical.unit, "cm");
  assert.equal(horizontal.ticks.find((tick) => tick.valueMm === 10)?.label, undefined);
  assert.equal(horizontal.ticks.find((tick) => tick.valueMm === 20)?.label, "2");
  assert.equal(horizontal.ticks.find((tick) => tick.valueMm === 5), undefined);
  assert.equal(vertical.ticks.find((tick) => tick.valueMm === 20)?.label, "2");
  assert.equal(vertical.ticks.find((tick) => tick.valueMm === 30)?.label, undefined);
  assert.equal(formatRulerDimension(121, horizontal.unit), "12.1 cm");
  assert.equal(formatRulerDimension(38.7, vertical.unit), "3.87 cm");
});

test("widens the label interval for a 25 cm square without removing centimetre notches", () => {
  const ruler = buildRulerScale(250, 250);
  const labels = ruler.ticks.flatMap((tick) => tick.label === undefined ? [] : [tick.label]);

  assert.equal(ruler.unit, "cm");
  assert.deepEqual(labels, ["0", "5", "10", "15", "20", "25"]);
  assert.equal(ruler.ticks.find((tick) => tick.valueMm === 10)?.label, undefined);
  assert.equal(ruler.ticks.find((tick) => tick.valueMm === 10)?.major, false);
  assert.equal(ruler.ticks.find((tick) => tick.valueMm === 50)?.major, true);
});

test("keeps adaptive centimetre labels synchronized across both axes", () => {
  const horizontal = buildRulerScale(249, 249);
  const vertical = buildRulerScale(83, 249);

  assert.equal(horizontal.ticks.find((tick) => tick.valueMm === 50)?.label, "5");
  assert.equal(horizontal.ticks.find((tick) => tick.valueMm === 20)?.label, undefined);
  assert.equal(vertical.ticks.find((tick) => tick.valueMm === 50)?.label, "5");
  assert.equal(vertical.ticks.find((tick) => tick.valueMm === 20)?.label, undefined);
});

test("returns no ruler ticks for invalid dimensions", () => {
  assert.deepEqual(buildRulerScale(0, 100), { unit: "mm", ticks: [] });
  assert.deepEqual(buildRulerScale(Number.NaN, 100), { unit: "mm", ticks: [] });
});
